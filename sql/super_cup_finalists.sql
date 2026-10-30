create table public.fz_super_cup_final (
season_year integer primary key,
home_team_id bigint references public.teams(id),
away_team_id bigint references public.teams(id),
constraint different_finalists check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id)
);
alter table public.fz_super_cup_final enable row level security;
grant select on public.fz_super_cup_final to anon, authenticated;
grant update(home_team_id,away_team_id) on public.fz_super_cup_final to authenticated;
create policy super_cup_public_read on public.fz_super_cup_final for select to anon,authenticated using(true);
create policy super_cup_admin_update on public.fz_super_cup_final for update to authenticated
using ((select public.get_my_admin_role()) in ('owner','master'))
with check ((select public.get_my_admin_role()) in ('owner','master'));
insert into public.fz_super_cup_final(season_year) values(2026);
