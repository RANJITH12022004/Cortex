-- Prompt 3 — order intake and procurement

CREATE TABLE public.stock_in_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL UNIQUE,
  part_id UUID NOT NULL REFERENCES public.parts (id) ON DELETE RESTRICT,
  vendor_id UUID REFERENCES public.vendors (id) ON DELETE SET NULL,
  qty NUMERIC(12, 3) NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
  notes TEXT,
  received_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stock_in_events_part_id_idx ON public.stock_in_events (part_id);
CREATE INDEX stock_in_events_vendor_id_idx ON public.stock_in_events (vendor_id);
CREATE INDEX stock_in_events_received_at_idx ON public.stock_in_events (received_at DESC);

ALTER TABLE public.material_handover
  ADD COLUMN damage_report_id UUID REFERENCES public.damage_reports (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX material_handover_initial_issue_unique_idx
  ON public.material_handover (serial_id, part_id)
  WHERE damage_report_id IS NULL;

CREATE UNIQUE INDEX material_handover_damage_report_unique_idx
  ON public.material_handover (damage_report_id)
  WHERE damage_report_id IS NOT NULL;

ALTER TABLE public.damage_reports
  ADD COLUMN qty NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (qty > 0),
  ADD COLUMN original_handover_id UUID REFERENCES public.material_handover (id) ON DELETE SET NULL,
  ADD COLUMN replacement_handover_id UUID REFERENCES public.material_handover (id) ON DELETE SET NULL;

CREATE INDEX damage_reports_original_handover_id_idx
  ON public.damage_reports (original_handover_id);

CREATE INDEX damage_reports_replacement_handover_id_idx
  ON public.damage_reports (replacement_handover_id);

ALTER TABLE public.stock_in_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_in_events_select_manager_procurement ON public.stock_in_events
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_procurement());

CREATE POLICY stock_in_events_insert_procurement ON public.stock_in_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_procurement() AND received_by = auth.uid());

CREATE OR REPLACE FUNCTION public.record_stock_in_event(
  p_request_id TEXT,
  p_part_id UUID,
  p_vendor_id UUID,
  p_qty NUMERIC,
  p_unit_cost NUMERIC,
  p_notes TEXT,
  p_received_by UUID
)
RETURNS public.stock_in_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.stock_in_events;
  v_result public.stock_in_events;
BEGIN
  SELECT *
  INTO v_existing
  FROM public.stock_in_events
  WHERE request_id = p_request_id;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  UPDATE public.parts
  SET
    qty_available = qty_available + p_qty,
    vendor_id = COALESCE(p_vendor_id, vendor_id),
    unit_cost = p_unit_cost
  WHERE id = p_part_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part not found';
  END IF;

  INSERT INTO public.stock_in_events (
    request_id,
    part_id,
    vendor_id,
    qty,
    unit_cost,
    notes,
    received_by
  )
  VALUES (
    p_request_id,
    p_part_id,
    p_vendor_id,
    p_qty,
    p_unit_cost,
    p_notes,
    p_received_by
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_serial_materials(
  p_serial_id UUID,
  p_issued_by UUID
)
RETURNS SETOF public.material_handover
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count INTEGER;
  v_product_id UUID;
  v_row RECORD;
  v_available NUMERIC;
BEGIN
  SELECT COUNT(*)
  INTO v_existing_count
  FROM public.material_handover
  WHERE serial_id = p_serial_id
    AND damage_report_id IS NULL;

  IF v_existing_count > 0 THEN
    RETURN QUERY
      SELECT *
      FROM public.material_handover
      WHERE serial_id = p_serial_id
        AND damage_report_id IS NULL
      ORDER BY issued_at, id;
    RETURN;
  END IF;

  SELECT pr.product_id
  INTO v_product_id
  FROM public.serials s
  JOIN public.purchase_requests pr ON pr.id = s.pr_id
  WHERE s.id = p_serial_id;

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Serial not found';
  END IF;

  FOR v_row IN
    SELECT b.part_id, b.qty_required
    FROM public.bom b
    WHERE b.product_id = v_product_id
    ORDER BY b.id
  LOOP
    SELECT qty_available
    INTO v_available
    FROM public.parts
    WHERE id = v_row.part_id
    FOR UPDATE;

    IF v_available IS NULL THEN
      RAISE EXCEPTION 'Part missing for BOM line %', v_row.part_id;
    END IF;

    IF v_available < v_row.qty_required THEN
      RAISE EXCEPTION 'Insufficient stock for part %', v_row.part_id;
    END IF;

    UPDATE public.parts
    SET
      qty_available = qty_available - v_row.qty_required,
      last_used_at = NOW()
    WHERE id = v_row.part_id;

    INSERT INTO public.material_handover (
      serial_id,
      part_id,
      qty,
      issued_by
    )
    VALUES (
      p_serial_id,
      v_row.part_id,
      v_row.qty_required,
      p_issued_by
    );
  END LOOP;

  RETURN QUERY
    SELECT *
    FROM public.material_handover
    WHERE serial_id = p_serial_id
      AND damage_report_id IS NULL
    ORDER BY issued_at, id;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_damage_replacement(
  p_damage_report_id UUID,
  p_issued_by UUID
)
RETURNS public.material_handover
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_damage public.damage_reports;
  v_existing public.material_handover;
  v_result public.material_handover;
  v_available NUMERIC;
BEGIN
  SELECT *
  INTO v_damage
  FROM public.damage_reports
  WHERE id = p_damage_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Damage report not found';
  END IF;

  IF v_damage.replacement_handover_id IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.material_handover
    WHERE id = v_damage.replacement_handover_id;

    RETURN v_existing;
  END IF;

  SELECT qty_available
  INTO v_available
  FROM public.parts
  WHERE id = v_damage.part_id
  FOR UPDATE;

  IF v_available IS NULL THEN
    RAISE EXCEPTION 'Part not found';
  END IF;

  IF v_available < v_damage.qty THEN
    RAISE EXCEPTION 'Insufficient stock for replacement';
  END IF;

  UPDATE public.parts
  SET
    qty_available = qty_available - v_damage.qty,
    last_used_at = NOW()
  WHERE id = v_damage.part_id;

  INSERT INTO public.material_handover (
    serial_id,
    part_id,
    qty,
    damage_report_id,
    issued_by
  )
  VALUES (
    v_damage.serial_id,
    v_damage.part_id,
    v_damage.qty,
    v_damage.id,
    p_issued_by
  )
  RETURNING * INTO v_result;

  UPDATE public.damage_reports
  SET
    replacement_issued_by = p_issued_by,
    replacement_issued_at = NOW(),
    replacement_handover_id = v_result.id
  WHERE id = p_damage_report_id;

  RETURN v_result;
END;
$$;
