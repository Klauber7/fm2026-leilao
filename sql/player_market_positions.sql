create or replace function public.fz_market_position_categories(ratings smallint[])
returns text[]
language sql
immutable
strict
set search_path = ''
as $$
  select case when cardinality(ratings) = 15 then
    array_remove(array[
      case when ratings[1] >= 18 then 'Goleiro' end,
      case when ratings[4] >= 18 then 'Zagueiro' end,
      case when greatest(ratings[5], ratings[15]) >= 18 then 'Lateral direito' end,
      case when greatest(ratings[3], ratings[14]) >= 18 then 'Lateral esquerdo' end,
      case when greatest(ratings[6], ratings[8]) >= 18 then 'Volante' end,
      case when ratings[11] >= 18 then 'Meia ofensivo central' end,
      case when greatest(ratings[7], ratings[10]) >= 18 then 'Meia ofensivo esquerdo' end,
      case when greatest(ratings[9], ratings[12]) >= 18 then 'Meia ofensivo direito' end,
      case when ratings[13] >= 18 then 'Centroavante' end
    ], null)
  end
$$;

create or replace function public.fz_sync_market_position_categories()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mapped text[] := public.fz_market_position_categories(new.position_ratings);
begin
  if cardinality(mapped) > 0 then
    new.category := mapped;
  elsif cardinality(new.position_ratings) = 15 and new.position_ratings[2] >= 18 then
    new.category := array['Zagueiro'];
  end if;
  return new;
end;
$$;

create or replace trigger trg_fz_sync_market_position_categories
before insert or update of position_ratings, category on public.players
for each row execute function public.fz_sync_market_position_categories();

with mapped_players as (
  select id, public.fz_market_position_categories(position_ratings) as mapped
  from public.players
)
update public.players p
set category = case when cardinality(m.mapped) > 0 then m.mapped else array['Zagueiro'] end
from mapped_players m
where p.id = m.id
  and (cardinality(m.mapped) > 0 or (cardinality(p.position_ratings) = 15 and p.position_ratings[2] >= 18))
  and p.category is distinct from case when cardinality(m.mapped) > 0 then m.mapped else array['Zagueiro'] end;

-- Keep older clients and bookmarks working while the new tabs roll out.
do $migration$
declare
  original text;
  revised text;
begin
  select pg_get_functiondef(oid) into strict original
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname = 'search_players_market_filtered';

  revised := replace(original,
    $old$where_sql := where_sql || format(' and %L = any(p.category)', p_category);$old$,
    $new$where_sql := where_sql || format(' and p.category && %L::text[]',
      case p_category
        when 'Lateral' then array['Lateral', 'Lateral direito', 'Lateral esquerdo']
        when 'Ponta' then array['Ponta', 'Meia ofensivo esquerdo', 'Meia ofensivo direito']
        when 'Meia Atacante' then array['Meia Atacante', 'Meia ofensivo central']
        when 'Atacante' then array['Atacante', 'Centroavante']
        else array[p_category]
      end);$new$);
  if revised <> original then
    execute revised;
  elsif strpos(original, 'p.category &&') = 0 then
    raise exception 'Unexpected market search category predicate';
  end if;
end
$migration$;
