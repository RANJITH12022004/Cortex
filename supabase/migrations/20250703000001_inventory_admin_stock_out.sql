-- Admin inherits manager inventory permissions; add manual stock-out ledger.

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_role() IN ('admin', 'manager', 'senior_manager');
$$;

CREATE TABLE public.stock_out_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL UNIQUE,
  part_id UUID NOT NULL REFERENCES public.parts (id) ON DELETE RESTRICT,
  qty NUMERIC(12, 3) NOT NULL CHECK (qty > 0),
  reason TEXT NOT NULL,
  notes TEXT,
  issued_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stock_out_events_part_id_idx ON public.stock_out_events (part_id);
CREATE INDEX stock_out_events_issued_at_idx ON public.stock_out_events (issued_at DESC);

ALTER TABLE public.stock_out_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_out_events_select_staff ON public.stock_out_events
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_procurement());

CREATE POLICY stock_out_events_insert_procurement ON public.stock_out_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_procurement() OR public.is_manager_or_admin())
    AND issued_by = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.record_stock_out_event(
  p_request_id TEXT,
  p_part_id UUID,
  p_qty NUMERIC,
  p_reason TEXT,
  p_notes TEXT,
  p_issued_by UUID
)
RETURNS public.stock_out_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.stock_out_events;
  v_result public.stock_out_events;
  v_available NUMERIC;
BEGIN
  SELECT *
  INTO v_existing
  FROM public.stock_out_events
  WHERE request_id = p_request_id;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT qty_available
  INTO v_available
  FROM public.parts
  WHERE id = p_part_id
  FOR UPDATE;

  IF v_available IS NULL THEN
    RAISE EXCEPTION 'Part not found';
  END IF;

  IF v_available < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock for this part';
  END IF;

  UPDATE public.parts
  SET
    qty_available = qty_available - p_qty,
    last_used_at = NOW()
  WHERE id = p_part_id;

  INSERT INTO public.stock_out_events (
    request_id,
    part_id,
    qty,
    reason,
    notes,
    issued_by
  )
  VALUES (
    p_request_id,
    p_part_id,
    p_qty,
    p_reason,
    p_notes,
    p_issued_by
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_stock_out_event TO authenticated;

-- Procurement maintains vendors; admin/managers retain access.
DROP POLICY IF EXISTS vendors_insert_manager ON public.vendors;
DROP POLICY IF EXISTS vendors_update_manager ON public.vendors;
DROP POLICY IF EXISTS vendors_delete_manager ON public.vendors;

CREATE POLICY vendors_insert_staff ON public.vendors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_procurement() OR public.is_manager());

CREATE POLICY vendors_update_staff ON public.vendors
  FOR UPDATE TO authenticated
  USING (public.is_procurement() OR public.is_manager())
  WITH CHECK (public.is_procurement() OR public.is_manager());

CREATE POLICY vendors_delete_staff ON public.vendors
  FOR DELETE TO authenticated
  USING (public.is_manager());
