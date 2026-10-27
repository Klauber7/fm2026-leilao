-- Private planning and lineups. This table never changes contracts or budgets.
create table public.team_plans (
  id uuid primary key default gen_random_uuid(),
  team_id bigint not null references public.teams(id) on delete cascade,
  kind text not null check (kind in ('lineup', 'planning')),
  name text not null check (length(btrim(name)) between 1 and 80),
  formation text not null default '4-3-3'
    check (formation in ('4-3-3','4-2-3-1','4-4-2','3-5-2','4-1-4-1')),
  starters bigint[] not null default array_fill(null::bigint, array[11]),
  targets bigint[] not null default '{}',
  staff_budget numeric not null default 0 check (staff_budget >= 0 and staff_budget <= 1000000000000),
  updated_at timestamptz not null default now(),
  check (array_ndims(starters) = 1 and array_lower(starters, 1) = 1 and cardinality(starters) = 11),
  check (cardinality(targets) <= 100 and (cardinality(targets) = 0 or (array_ndims(targets) = 1 and array_lower(targets, 1) = 1))),
  check (kind = 'planning' or (cardinality(targets) = 0 and staff_budget = 0))
);
create index team_plans_team_idx on public.team_plans(team_id);
create unique index team_plans_one_lineup on public.team_plans(team_id) where kind = 'lineup';

alter table public.team_plans enable row level security;
revoke all on public.team_plans from public, anon, authenticated;
grant select, insert, update, delete on public.team_plans to authenticated;

create policy team_plans_select on public.team_plans for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.manager_id = (select auth.uid())));
create policy team_plans_insert on public.team_plans for insert to authenticated
  with check (exists (select 1 from public.teams t where t.id = team_id and t.manager_id = (select auth.uid())));
create policy team_plans_update on public.team_plans for update to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.manager_id = (select auth.uid())))
  with check (exists (select 1 from public.teams t where t.id = team_id and t.manager_id = (select auth.uid())));
create policy team_plans_delete on public.team_plans for delete to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.manager_id = (select auth.uid())));

create function public.validate_team_plan() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from unnest(new.starters) x where x is not null)
      <> (select count(distinct x) from unnest(new.starters) x where x is not null)
    or cardinality(new.targets) <> (select count(distinct x) from unnest(new.targets) x)
  then raise exception 'DUPLICATE_PLAN_PLAYER'; end if;

  if exists (
    select 1 from unnest(new.starters || new.targets) x
    left join public.players p on p.id = x
    where x is not null and (p.id is null or (new.kind = 'lineup' and p.team_id is distinct from new.team_id))
  ) then raise exception 'PLAN_PLAYER_UNAVAILABLE'; end if;

  if new.kind = 'planning' and exists (
    select 1 from unnest(new.starters) x join public.players p on p.id = x
    where p.team_id is distinct from new.team_id and not (x = any(new.targets))
  ) then raise exception 'PLAN_TARGET_MISSING'; end if;

  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function public.validate_team_plan() from public, anon, authenticated;
create trigger validate_team_plan before insert or update on public.team_plans
  for each row execute function public.validate_team_plan();
