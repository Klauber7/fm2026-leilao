-- The composite key keeps listings tied to the squad that published them.
alter table public.players add constraint players_id_team_id_key unique (id, team_id);

create table public.internal_player_listings (
  id uuid primary key default gen_random_uuid(),
  player_id bigint not null unique,
  team_id bigint not null references public.teams(id) on delete cascade,
  asking_price numeric not null check (
    asking_price > 0 and asking_price <= 1000000000000
    and asking_price = round(asking_price, 2)
  ),
  created_at timestamptz not null default now(),
  foreign key (player_id, team_id) references public.players(id, team_id) on delete cascade
);

create index internal_player_listings_team_idx on public.internal_player_listings(team_id);

alter table public.internal_player_listings enable row level security;
revoke all on public.internal_player_listings from public, anon, authenticated;
grant select, delete on public.internal_player_listings to authenticated;
grant insert (player_id, team_id, asking_price) on public.internal_player_listings to authenticated;
grant update (asking_price) on public.internal_player_listings to authenticated;

create policy internal_player_listings_read on public.internal_player_listings
  for select to authenticated using (true);

create policy internal_player_listings_insert on public.internal_player_listings
  for insert to authenticated with check (
    exists (select 1 from public.teams t where t.id = team_id and t.manager_id = (select auth.uid()))
  );

create policy internal_player_listings_update on public.internal_player_listings
  for update to authenticated using (
    exists (select 1 from public.teams t where t.id = team_id and t.manager_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.teams t where t.id = team_id and t.manager_id = (select auth.uid()))
  );

create policy internal_player_listings_delete on public.internal_player_listings
  for delete to authenticated using (
    exists (select 1 from public.teams t where t.id = team_id and t.manager_id = (select auth.uid()))
  );

create schema if not exists internal_market_private;

create function internal_market_private.remove_listing_on_squad_change()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.internal_player_listings
  where player_id = old.id and team_id = old.team_id;
  return new;
end;
$$;

revoke all on function internal_market_private.remove_listing_on_squad_change()
  from public, anon, authenticated;

create trigger remove_listing_on_squad_change
  before update of team_id on public.players
  for each row when (old.team_id is distinct from new.team_id and old.team_id is not null)
  execute function internal_market_private.remove_listing_on_squad_change();
