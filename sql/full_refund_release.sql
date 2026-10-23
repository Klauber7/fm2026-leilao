-- One full-refund release per team for this special release round.
create table public.full_refund_releases (
  id uuid primary key default gen_random_uuid(),
  team_id bigint not null unique references public.teams(id),
  team_name text not null,
  player_id bigint references public.players(id) on delete set null,
  player_unique_id text,
  player_name text not null,
  original_value numeric not null check (original_value > 0),
  refund numeric not null check (refund = original_value),
  created_at timestamptz not null default now()
);
alter table public.full_refund_releases enable row level security;
revoke all on public.full_refund_releases from public, anon, authenticated;
grant select on public.full_refund_releases to anon, authenticated;
create policy full_refund_public_ledger on public.full_refund_releases
  for select to anon, authenticated using (true);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.release_player_full_refund(p_player_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_team public.teams%rowtype;
  v_player public.players%rowtype;
  v_release public.full_refund_releases%rowtype;
  v_budget numeric;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_team from public.teams where manager_id = v_user order by id limit 1 for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if exists (select 1 from public.full_refund_releases where team_id = v_team.id) then
    raise exception 'FULL_REFUND_ALREADY_USED';
  end if;
  select * into v_player from public.players where id = p_player_id for update;
  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;
  if v_player.team_id is distinct from v_team.id then raise exception 'PLAYER_NOT_OWNED'; end if;
  if coalesce(v_player.drafted, false) then raise exception 'DRAFT_PLAYER_LOCKED'; end if;
  if v_player.value is null or v_player.value <= 0 then raise exception 'INVALID_PLAYER_VALUE'; end if;
  if exists (select 1 from public.player_loans where player_id = p_player_id and status in ('pending','active')) then
    raise exception 'PLAYER_ON_LOAN';
  end if;
  if exists (select 1 from public.negotiations where player_id = p_player_id and status in ('pending','countered'))
     or exists (select 1 from public.transfer_player_locks where player_id = p_player_id)
     or exists (select 1 from public.auctions where player_id = p_player_id and status in ('active','paused')) then
    raise exception 'PLAYER_IN_NEGOTIATION';
  end if;

  insert into public.full_refund_releases(team_id,team_name,player_id,player_unique_id,player_name,original_value,refund)
    values(v_team.id,v_team.name,v_player.id,v_player.unique_id,v_player.name,v_player.value,v_player.value)
    returning * into v_release;
  v_budget := coalesce(v_team.budget,0) + v_player.value;
  update public.players set team_id = null, team = null, available = true where id = v_player.id;
  update public.teams set budget = v_budget where id = v_team.id;
  insert into public.financial_transactions(team_id,team_name,transaction_type,amount,reason,balance_before,balance_after,admin_user_id)
    values(v_team.id,v_team.name,'credit',v_player.value,
      'Dispensa especial 100%: ' || v_player.name,coalesce(v_team.budget,0),v_budget,v_user);
  return jsonb_build_object('success',true,'release_id',v_release.id,'player_name',v_player.name,
    'refund',v_player.value,'new_budget',v_budget);
end $$;
revoke all on function private.release_player_full_refund(bigint) from public, anon;
grant execute on function private.release_player_full_refund(bigint) to authenticated;

create function public.release_player_full_refund(p_player_id bigint)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.release_player_full_refund(p_player_id);
$$;
revoke all on function public.release_player_full_refund(bigint) from public, anon;
grant execute on function public.release_player_full_refund(bigint) to authenticated;

-- Keep the BID updated while it is open.
alter publication supabase_realtime add table public.full_refund_releases;
