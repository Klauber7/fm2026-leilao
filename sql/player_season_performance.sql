create table public.player_season_performance (
  player_id bigint primary key references public.players(id) on delete cascade,
  save_date date not null,
  appearances integer not null check (appearances >= 0),
  goals integer not null check (goals >= 0),
  assists integer not null check (assists >= 0),
  player_of_match integer check (player_of_match between 0 and appearances),
  average_rating numeric(4,2) check (average_rating between 0 and 10)
);
alter table public.player_season_performance enable row level security;
revoke all on table public.player_season_performance from anon, authenticated;
grant select on table public.player_season_performance to anon, authenticated;
create policy "Read player season performance" on public.player_season_performance
  for select to anon, authenticated using (true);
notify pgrst, 'reload schema';
