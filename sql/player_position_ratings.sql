alter table public.players add column if not exists position_ratings smallint[];

comment on column public.players.position_ratings is 'FM26 position familiarity (1–20), in order GK, SW, DL, DC, DR, DM, ML, MC, MR, AML, AMC, AMR, STC, WBL, WBR. NULL when no save match exists.';

CREATE OR REPLACE FUNCTION public.search_players_market_filtered(p_filters jsonb DEFAULT '[]'::jsonb, p_category text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_nationality text DEFAULT NULL::text, p_min_ca numeric DEFAULT NULL::numeric, p_max_ca numeric DEFAULT NULL::numeric, p_min_cp numeric DEFAULT NULL::numeric, p_max_cp numeric DEFAULT NULL::numeric, p_min_age numeric DEFAULT NULL::numeric, p_max_age numeric DEFAULT NULL::numeric, p_min_value numeric DEFAULT NULL::numeric, p_max_value numeric DEFAULT NULL::numeric, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  f jsonb;
  attr text;
  minv numeric;
  maxv numeric;
  col text;
  term text;
  where_sql text := ' where true ';
  count_sql text;
  data_sql text;
  total_count bigint := 0;
  items jsonb := '[]'::jsonb;
begin
  if p_category is not null and btrim(p_category) <> '' and p_category <> 'Todos' then
    where_sql := where_sql || format(' and %L = any(p.category)', p_category);
  end if;

  if p_search is not null and btrim(p_search) <> '' then
    foreach term in array regexp_split_to_array(btrim(p_search), '\\s+') loop
      if term <> '' then
        where_sql := where_sql || format(' and p.search_name ilike %L', '%' || term || '%');
      end if;
    end loop;
  end if;

  if p_nationality is not null and btrim(p_nationality) <> '' then
    where_sql := where_sql || format(' and p.nationality ilike %L', '%' || btrim(p_nationality) || '%');
  end if;

  if p_min_ca is not null then where_sql := where_sql || format(' and p.ca >= %L', p_min_ca); end if;
  if p_max_ca is not null then where_sql := where_sql || format(' and p.ca <= %L', p_max_ca); end if;
  if p_min_cp is not null then where_sql := where_sql || format(' and p.cp >= %L', p_min_cp); end if;
  if p_max_cp is not null then where_sql := where_sql || format(' and p.cp <= %L', p_max_cp); end if;
  if p_min_age is not null then where_sql := where_sql || format(' and p.age >= %L', p_min_age); end if;
  if p_max_age is not null then where_sql := where_sql || format(' and p.age <= %L', p_max_age); end if;
  if p_min_value is not null then where_sql := where_sql || format(' and p.value >= %L', p_min_value); end if;
  if p_max_value is not null then where_sql := where_sql || format(' and p.value <= %L', p_max_value); end if;

  for f in select * from jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) loop
    attr := f->>'attribute';
    minv := nullif(f->>'min','')::numeric;
    maxv := nullif(f->>'max','')::numeric;

    col := case attr
      when '(Tendência) para Saídas da Baliza' then 'rushing_out'
      when 'Aceleração' then 'acceleration'
      when 'Agilidade' then 'agility'
      when 'Agressividade' then 'aggression'
      when 'Alcance Aéreo' then 'aerial_reach'
      when 'Antecipação' then 'anticipation'
      when 'Aptidão Física' then 'natural_fitness'
      when 'Bravura' then 'bravery'
      when 'Cabeceamento' then 'heading'
      when 'Cantos' then 'corners'
      when 'Comando de Área' then 'command_of_area'
      when 'Compostura' then 'composure'
      when 'Comunicação' then 'communication'
      when 'Concentração' then 'concentration'
      when 'Cruzamentos' then 'crossing'
      when 'Decisões' then 'decisions'
      when 'Desarme' then 'tackling'
      when 'Determinação' then 'determination'
      when 'Equilíbrio' then 'balance'
      when 'Excentricidade' then 'eccentricity'
      when 'Finalização' then 'finishing'
      when 'Finta' then 'dribbling'
      when 'Força' then 'strength'
      when 'Imprevisibilidade' then 'flair'
      when 'Impulsão' then 'jumping_reach'
      when 'Índice de Trabalho' then 'work_rate'
      when 'Jogo de Mãos' then 'handling'
      when 'Lançamentos' then 'throwing'
      when 'Lançamentos Longos' then 'long_throws'
      when 'Liderança' then 'leadership'
      when 'Livres' then 'free_kicks'
      when 'Marcação' then 'marking'
      when 'Marcação de Penáltis' then 'penalties'
      when 'Passe' then 'passing'
      when 'Pontapé' then 'kicking'
      when 'Posicionamento' then 'positioning'
      when 'Primeiro Toque' then 'first_touch'
      when 'Reflexos' then 'reflexes'
      when 'Remates de Longe' then 'long_shots'
      when 'Resistência' then 'stamina'
      when 'Saídas a Punhos' then 'punching'
      when 'Sem Bola' then 'off_the_ball'
      when 'Técnica' then 'technique'
      when 'Trabalho de Equipa' then 'teamwork'
      when 'Um Para Um' then 'one_on_ones'
      when 'Velocidade' then 'pace'
      when 'Visão de Jogo' then 'vision'
      else null
    end;

    if col is not null then
      if minv is not null then
        where_sql := where_sql || format(' and p.%I >= %L', col, minv);
      end if;
      if maxv is not null then
        where_sql := where_sql || format(' and p.%I <= %L', col, maxv);
      end if;
    end if;
  end loop;

  count_sql := 'select count(*) from public.players p' || where_sql;
  execute count_sql into total_count;

  data_sql :=
    'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (' ||
    ' select p.id, p.unique_id, p.name, p.age, p.position, p.nationality, p.club, p.ca, p.cp, p.value, p.image_url, p.category, p.team_id, p.position_ratings' ||
    ' from public.players p' || where_sql ||
    ' order by p.ca desc nulls last, p.cp desc nulls last, p.name asc' ||
    format(' offset %s limit %s', greatest(coalesce(p_offset,0),0), greatest(least(coalesce(p_limit,50),200),1)) ||
    ') x';

  execute data_sql into items;

  return jsonb_build_object(
    'items', items,
    'total', total_count
  );
end;
$function$
;

