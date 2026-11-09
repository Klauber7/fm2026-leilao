create table public.player_availability_snapshot (
  player_id bigint primary key references public.players(id) on delete cascade,
  save_date date not null,
  injury_return_date date check (injury_return_date > save_date),
  suspended boolean not null,
  check (injury_return_date is not null or suspended)
);
alter table public.player_availability_snapshot enable row level security;
revoke all on table public.player_availability_snapshot from anon, authenticated;
grant select on table public.player_availability_snapshot to anon, authenticated;
create policy "Read player availability snapshot" on public.player_availability_snapshot
  for select to anon, authenticated using (true);
notify pgrst, 'reload schema';
