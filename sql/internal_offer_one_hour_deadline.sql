ALTER TABLE public.negotiations ADD COLUMN expires_at timestamptz;
UPDATE public.negotiations SET expires_at = created_at + interval '1 hour';
ALTER TABLE public.negotiations ALTER COLUMN expires_at SET DEFAULT (now() + interval '1 hour');
CREATE OR REPLACE FUNCTION public.enforce_internal_offer_deadline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent_row public.negotiations%rowtype;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := clock_timestamp();
    NEW.expires_at := NEW.created_at + interval '1 hour';
    IF NEW.parent_negotiation_id IS NOT NULL THEN
      SELECT * INTO parent_row FROM public.negotiations WHERE id = NEW.parent_negotiation_id FOR UPDATE;
      IF NOT FOUND OR parent_row.status <> 'pending' THEN
        RAISE EXCEPTION 'NEGOTIATION_NOT_ACTIVE';
      END IF;
      IF parent_row.expires_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'NEGOTIATION_EXPIRED';
      END IF;
      IF NEW.buyer_team_id IS DISTINCT FROM parent_row.buyer_team_id
         OR NEW.seller_team_id IS DISTINCT FROM parent_row.seller_team_id
         OR NEW.player_id IS DISTINCT FROM parent_row.player_id
         OR NEW.created_by_team_id IS NOT DISTINCT FROM parent_row.created_by_team_id
         OR NEW.created_by_team_id NOT IN (parent_row.buyer_team_id, parent_row.seller_team_id) THEN
        RAISE EXCEPTION 'INVALID_COUNTEROFFER';
      END IF;
      UPDATE public.negotiations SET status = 'countered', updated_at = clock_timestamp()
      WHERE id = parent_row.id;
    END IF;
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.expires_at := OLD.expires_at;
    IF OLD.status = 'pending' AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status <> 'cancelled' AND OLD.expires_at <= clock_timestamp() THEN
      RAISE EXCEPTION 'NEGOTIATION_EXPIRED';
    END IF;
    IF OLD.status <> 'pending' AND NEW.status = 'pending' THEN
      RAISE EXCEPTION 'NEGOTIATION_NOT_ACTIVE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_internal_offer_deadline() FROM PUBLIC;
CREATE TRIGGER enforce_internal_offer_deadline
BEFORE INSERT OR UPDATE ON public.negotiations
FOR EACH ROW EXECUTE FUNCTION public.enforce_internal_offer_deadline();
CREATE INDEX negotiations_pending_expiry_idx ON public.negotiations(expires_at) WHERE status = 'pending';
SELECT cron.schedule('expire-internal-offers', '1 second', $job$
UPDATE public.negotiations SET status = 'cancelled', cancelled_at = clock_timestamp(), updated_at = clock_timestamp()
WHERE status = 'pending' AND expires_at <= clock_timestamp();
$job$);
UPDATE public.negotiations SET status = 'cancelled', cancelled_at = clock_timestamp(), updated_at = clock_timestamp()
WHERE status = 'pending' AND expires_at <= clock_timestamp();