CREATE OR REPLACE FUNCTION public.release_staff(p_coach_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_team_id bigint;
  v_team_name text;
  v_coach_name text;
  v_budget_before numeric := 0;
  v_budget_after numeric := 0;
  v_market_value numeric := 0;
  v_refund numeric := 0;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select t.id, t.name, coalesce(t.budget, 0)
  into v_team_id, v_team_name, v_budget_before
  from public.teams t
  where t.manager_id = v_user_id
  limit 1
  for update;

  if v_team_id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  select c.name, coalesce(c.value, 0)
  into v_coach_name, v_market_value
  from public.coaches c
  where c.id = p_coach_id
  limit 1
  for update;

  if v_coach_name is null then
    raise exception 'STAFF_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.coaches c
    where c.id = p_coach_id
      and c.team_id = v_team_id
  ) then
    raise exception 'STAFF_NOT_OWNED';
  end if;

  v_refund := round(greatest(v_market_value, 0) * 0.50, 2);
  v_budget_after := v_budget_before + v_refund;

  update public.teams
  set budget = v_budget_after
  where id = v_team_id;

  update public.coaches
  set team_id = null,
      hired_at = null
  where id = p_coach_id
    and team_id = v_team_id;

  if not found then
    raise exception 'STAFF_NOT_OWNED';
  end if;

  insert into public.staff_draft_transfers (
    coach_id, coach_name,
    from_team_id, from_team_name,
    to_team_id, to_team_name,
    amount, transfer_type, admin_user_id
  ) values (
    p_coach_id, v_coach_name,
    v_team_id, v_team_name,
    null, 'Mercado / Livre',
    v_refund, 'release50', v_user_id
  );

  if v_refund > 0 then
    insert into public.financial_transactions (
      team_id, team_name, transaction_type, amount, reason,
      balance_before, balance_after, admin_user_id
    ) values (
      v_team_id, v_team_name, 'credit', v_refund,
      'Dispensa de staff — ' || v_coach_name || ' — reembolso de 50%',
      v_budget_before, v_budget_after, v_user_id
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'coach_id', p_coach_id,
    'coach_name', v_coach_name,
    'team_id', v_team_id,
    'market_value', v_market_value,
    'refund', v_refund,
    'budget_before', v_budget_before,
    'budget_after', v_budget_after,
    'bid_recorded', true
  );
end;
$function$
;
