begin;

create table public.full_refund_release_limits (
  team_id bigint primary key references public.teams(id),
  allowance integer not null check (allowance > 0)
);
alter table public.full_refund_release_limits enable row level security;
revoke all on public.full_refund_release_limits from public, anon, authenticated;
grant select on public.full_refund_release_limits to anon, authenticated;
create policy full_refund_limits_read on public.full_refund_release_limits
  for select to anon, authenticated using (true);

-- Keep the completed release history and restore exactly one available use.
lock table public.teams in exclusive mode;
insert into public.full_refund_release_limits(team_id, allowance)
select team_id, count(*)::integer + 1
from public.full_refund_releases
group by team_id;

alter table public.full_refund_releases drop constraint full_refund_releases_team_id_key;
create index full_refund_releases_team_id_idx on public.full_refund_releases(team_id);

CREATE OR REPLACE FUNCTION private.release_player_full_refund(p_player_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if (select count(*) from public.full_refund_releases where team_id = v_team.id)
     >= coalesce((select allowance from public.full_refund_release_limits where team_id = v_team.id), 1) then
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
end $function$

;
commit;

