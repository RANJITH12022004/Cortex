-- Rack → box → part placements. parts.qty_available is the sum of box quantities.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_role() = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.is_inventory()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_role() = 'inventory';
$$;

-- Super admin inherits manager and admin checks so existing policies still cover that role.
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_role() IN ('super_admin', 'admin', 'manager', 'senior_manager');
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_role() IN ('super_admin', 'admin', 'manager', 'senior_manager');
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_role() IN (
    'super_admin',
    'admin',
    'manager',
    'senior_manager',
    'inventory',
    'procurement',
    'employee',
    'user'
  );
$$;

-- Box quantities and the part catalog. Managers can search; they do not write stock.
CREATE OR REPLACE FUNCTION public.can_write_stock()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_role() IN ('super_admin', 'admin', 'inventory', 'procurement');
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_stock() TO authenticated;

-- Admin may not edit a super admin account.
DROP POLICY IF EXISTS users_update_admin ON public.users;
CREATE POLICY users_update_admin ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_admin() AND role IS DISTINCT FROM 'super_admin')
  WITH CHECK (public.is_admin() AND role IS DISTINCT FROM 'super_admin');

CREATE POLICY users_select_super_admin ON public.users
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY users_update_super_admin ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TABLE public.racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT racks_code_unique UNIQUE (code)
);

CREATE INDEX racks_code_trgm_idx ON public.racks USING gin (code extensions.gin_trgm_ops);
CREATE INDEX racks_name_trgm_idx ON public.racks USING gin (name extensions.gin_trgm_ops);

CREATE TABLE public.boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_id UUID NOT NULL REFERENCES public.racks (id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT boxes_rack_code_unique UNIQUE (rack_id, code)
);

CREATE INDEX boxes_rack_id_idx ON public.boxes (rack_id);
CREATE INDEX boxes_code_trgm_idx ON public.boxes USING gin (code extensions.gin_trgm_ops);
CREATE INDEX boxes_name_trgm_idx ON public.boxes USING gin (name extensions.gin_trgm_ops);

CREATE TABLE public.part_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES public.parts (id) ON DELETE RESTRICT,
  box_id UUID NOT NULL REFERENCES public.boxes (id) ON DELETE RESTRICT,
  qty NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT part_locations_part_box_unique UNIQUE (part_id, box_id)
);

CREATE INDEX part_locations_part_id_idx ON public.part_locations (part_id);
CREATE INDEX part_locations_box_id_idx ON public.part_locations (box_id);

CREATE INDEX parts_name_trgm_idx ON public.parts USING gin (name extensions.gin_trgm_ops);
CREATE INDEX parts_mpn_trgm_idx ON public.parts USING gin (mpn extensions.gin_trgm_ops);
CREATE INDEX parts_description_trgm_idx ON public.parts USING gin (description extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.sync_part_qty_from_locations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part_id UUID;
BEGIN
  v_part_id := COALESCE(NEW.part_id, OLD.part_id);
  UPDATE public.parts
  SET qty_available = COALESCE((
    SELECT SUM(pl.qty)
    FROM public.part_locations pl
    WHERE pl.part_id = v_part_id
  ), 0)
  WHERE id = v_part_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER part_locations_sync_qty
AFTER INSERT OR UPDATE OR DELETE ON public.part_locations
FOR EACH ROW
EXECUTE FUNCTION public.sync_part_qty_from_locations();

ALTER TABLE public.racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY racks_select_staff ON public.racks
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY racks_insert_stock ON public.racks
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_stock() AND created_by = auth.uid());

CREATE POLICY racks_update_stock ON public.racks
  FOR UPDATE TO authenticated
  USING (public.can_write_stock())
  WITH CHECK (public.can_write_stock());

CREATE POLICY racks_delete_stock ON public.racks
  FOR DELETE TO authenticated
  USING (public.can_write_stock());

CREATE POLICY boxes_select_staff ON public.boxes
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY boxes_insert_stock ON public.boxes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_stock() AND created_by = auth.uid());

CREATE POLICY boxes_update_stock ON public.boxes
  FOR UPDATE TO authenticated
  USING (public.can_write_stock())
  WITH CHECK (public.can_write_stock());

CREATE POLICY boxes_delete_stock ON public.boxes
  FOR DELETE TO authenticated
  USING (public.can_write_stock());

CREATE POLICY part_locations_select_staff ON public.part_locations
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY part_locations_write_stock ON public.part_locations
  FOR ALL TO authenticated
  USING (public.can_write_stock())
  WITH CHECK (public.can_write_stock());

DROP POLICY IF EXISTS parts_insert_staff ON public.parts;
DROP POLICY IF EXISTS parts_update_staff ON public.parts;
DROP POLICY IF EXISTS parts_delete_manager ON public.parts;

CREATE POLICY parts_insert_stock ON public.parts
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_stock());

CREATE POLICY parts_update_stock ON public.parts
  FOR UPDATE TO authenticated
  USING (public.can_write_stock())
  WITH CHECK (public.can_write_stock());

CREATE POLICY parts_delete_stock ON public.parts
  FOR DELETE TO authenticated
  USING (public.can_write_stock());

DROP POLICY IF EXISTS vendors_insert_staff ON public.vendors;
DROP POLICY IF EXISTS vendors_update_staff ON public.vendors;

CREATE POLICY vendors_insert_staff ON public.vendors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_procurement() OR public.is_manager() OR public.is_inventory());

CREATE POLICY vendors_update_staff ON public.vendors
  FOR UPDATE TO authenticated
  USING (public.is_procurement() OR public.is_manager() OR public.is_inventory())
  WITH CHECK (public.is_procurement() OR public.is_manager() OR public.is_inventory());

-- Existing free-text bins become boxes on one unassigned rack.
INSERT INTO public.racks (code, name)
VALUES ('UNASSIGNED', 'Unassigned')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.boxes (rack_id, code, name)
SELECT
  r.id,
  COALESCE(NULLIF(btrim(p.storage_location), ''), 'UNASSIGNED'),
  COALESCE(NULLIF(btrim(p.storage_location), ''), 'Unassigned')
FROM public.parts p
JOIN public.racks r ON r.code = 'UNASSIGNED'
WHERE p.qty_available > 0
ON CONFLICT (rack_id, code) DO NOTHING;

INSERT INTO public.part_locations (part_id, box_id, qty)
SELECT
  p.id,
  b.id,
  p.qty_available
FROM public.parts p
JOIN public.racks r ON r.code = 'UNASSIGNED'
JOIN public.boxes b
  ON b.rack_id = r.id
 AND b.code = COALESCE(NULLIF(btrim(p.storage_location), ''), 'UNASSIGNED')
WHERE p.qty_available > 0
ON CONFLICT (part_id, box_id) DO NOTHING;

ALTER TABLE public.stock_in_events
  ADD COLUMN box_id UUID REFERENCES public.boxes (id) ON DELETE RESTRICT;

ALTER TABLE public.stock_out_events
  ADD COLUMN box_id UUID REFERENCES public.boxes (id) ON DELETE RESTRICT;

CREATE INDEX stock_in_events_box_id_idx ON public.stock_in_events (box_id);
CREATE INDEX stock_out_events_box_id_idx ON public.stock_out_events (box_id);

DROP POLICY IF EXISTS stock_in_events_select_manager_procurement ON public.stock_in_events;
CREATE POLICY stock_in_events_select_staff ON public.stock_in_events
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_procurement() OR public.is_inventory());

DROP POLICY IF EXISTS stock_out_events_select_staff ON public.stock_out_events;
CREATE POLICY stock_out_events_select_staff ON public.stock_out_events
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_procurement() OR public.is_inventory());

DROP FUNCTION IF EXISTS public.record_stock_in_event(TEXT, UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID);

CREATE FUNCTION public.record_stock_in_event(
  p_request_id TEXT,
  p_part_id UUID,
  p_box_id UUID,
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
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.stock_in_events
  WHERE request_id = p_request_id;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  UPDATE public.parts
  SET
    vendor_id = COALESCE(p_vendor_id, vendor_id),
    unit_cost = p_unit_cost
  WHERE id = p_part_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.boxes WHERE id = p_box_id) THEN
    RAISE EXCEPTION 'Box not found';
  END IF;

  INSERT INTO public.part_locations (part_id, box_id, qty)
  VALUES (p_part_id, p_box_id, p_qty)
  ON CONFLICT (part_id, box_id)
  DO UPDATE SET
    qty = public.part_locations.qty + EXCLUDED.qty,
    updated_at = NOW();

  INSERT INTO public.stock_in_events (
    request_id,
    part_id,
    box_id,
    vendor_id,
    qty,
    unit_cost,
    notes,
    received_by
  )
  VALUES (
    p_request_id,
    p_part_id,
    p_box_id,
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

GRANT EXECUTE ON FUNCTION public.record_stock_in_event(
  TEXT, UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID
) TO authenticated;

DROP FUNCTION IF EXISTS public.record_stock_out_event(TEXT, UUID, NUMERIC, TEXT, TEXT, UUID);

CREATE FUNCTION public.record_stock_out_event(
  p_request_id TEXT,
  p_part_id UUID,
  p_box_id UUID,
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
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.stock_out_events
  WHERE request_id = p_request_id;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT qty
  INTO v_available
  FROM public.part_locations
  WHERE part_id = p_part_id
    AND box_id = p_box_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stock in this box';
  END IF;

  IF v_available < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock in this box';
  END IF;

  UPDATE public.part_locations
  SET
    qty = qty - p_qty,
    updated_at = NOW()
  WHERE part_id = p_part_id
    AND box_id = p_box_id;

  UPDATE public.parts
  SET last_used_at = NOW()
  WHERE id = p_part_id;

  INSERT INTO public.stock_out_events (
    request_id,
    part_id,
    box_id,
    qty,
    reason,
    notes,
    issued_by
  )
  VALUES (
    p_request_id,
    p_part_id,
    p_box_id,
    p_qty,
    p_reason,
    p_notes,
    p_issued_by
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_stock_out_event(
  TEXT, UUID, UUID, NUMERIC, TEXT, TEXT, UUID
) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_inventory(
  p_query TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  part_id UUID,
  part_name TEXT,
  mpn TEXT,
  description TEXT,
  unit_cost NUMERIC,
  qty_available NUMERIC,
  location_id UUID,
  box_id UUID,
  box_code TEXT,
  box_name TEXT,
  rack_id UUID,
  rack_code TEXT,
  rack_name TEXT,
  qty_in_box NUMERIC,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_offset INTEGER;
  v_term TEXT;
  v_pattern TEXT;
BEGIN
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_term := btrim(COALESCE(p_query, ''));
  v_pattern := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.mpn,
    p.description,
    p.unit_cost,
    p.qty_available,
    pl.id,
    b.id,
    b.code,
    b.name,
    r.id,
    r.code,
    r.name,
    pl.qty,
    COUNT(*) OVER ()
  FROM public.parts p
  LEFT JOIN public.part_locations pl ON pl.part_id = p.id
  LEFT JOIN public.boxes b ON b.id = pl.box_id
  LEFT JOIN public.racks r ON r.id = b.rack_id
  WHERE v_term = ''
    OR p.name ILIKE v_pattern ESCAPE '\'
    OR COALESCE(p.mpn, '') ILIKE v_pattern ESCAPE '\'
    OR COALESCE(p.description, '') ILIKE v_pattern ESCAPE '\'
    OR COALESCE(r.code, '') ILIKE v_pattern ESCAPE '\'
    OR COALESCE(r.name, '') ILIKE v_pattern ESCAPE '\'
    OR COALESCE(b.code, '') ILIKE v_pattern ESCAPE '\'
    OR COALESCE(b.name, '') ILIKE v_pattern ESCAPE '\'
  ORDER BY p.name, r.code NULLS LAST, b.code NULLS LAST, pl.id
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_inventory(TEXT, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.import_inventory_rows(p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_row JSONB;
  v_part_id UUID;
  v_vendor_id UUID;
  v_rack_id UUID;
  v_box_id UUID;
  v_part_name TEXT;
  v_mpn TEXT;
  v_rack_code TEXT;
  v_box_code TEXT;
  v_qty NUMERIC;
  v_unit_cost NUMERIC;
  v_count INTEGER := 0;
BEGIN
  v_role := public.auth_user_role();
  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'inventory') THEN
    RAISE EXCEPTION 'Not allowed to import inventory';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Rows must be an array';
  END IF;

  IF jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'Import at most 2000 rows at a time';
  END IF;

  FOR v_row IN
    SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_part_name := btrim(COALESCE(v_row->>'part_name', ''));
    v_mpn := btrim(COALESCE(v_row->>'mpn', ''));
    v_rack_code := upper(btrim(COALESCE(v_row->>'rack_code', '')));
    v_box_code := upper(btrim(COALESCE(v_row->>'box_code', '')));

    IF v_part_name = '' OR v_rack_code = '' OR v_box_code = '' THEN
      RAISE EXCEPTION 'Each row needs part_name, rack_code, and box_code';
    END IF;

    BEGIN
      v_qty := COALESCE(NULLIF(btrim(COALESCE(v_row->>'qty', '')), '')::NUMERIC, 0);
      v_unit_cost := COALESCE(NULLIF(btrim(COALESCE(v_row->>'unit_cost', '')), '')::NUMERIC, 0);
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid number for part %', v_part_name;
    END;

    IF v_qty < 0 OR v_unit_cost < 0 THEN
      RAISE EXCEPTION 'Quantity and unit cost must be 0 or greater for part %', v_part_name;
    END IF;

    v_vendor_id := NULL;
    IF btrim(COALESCE(v_row->>'vendor_name', '')) <> '' THEN
      SELECT v.id
      INTO v_vendor_id
      FROM public.vendors v
      WHERE lower(v.name) = lower(btrim(v_row->>'vendor_name'))
      ORDER BY v.created_at
      LIMIT 1;

      IF v_vendor_id IS NULL THEN
        INSERT INTO public.vendors (name)
        VALUES (btrim(v_row->>'vendor_name'))
        RETURNING id INTO v_vendor_id;
      END IF;
    END IF;

    INSERT INTO public.racks (code, name, created_by)
    VALUES (
      v_rack_code,
      NULLIF(btrim(COALESCE(v_row->>'rack_name', '')), ''),
      auth.uid()
    )
    ON CONFLICT (code) DO UPDATE
    SET name = COALESCE(NULLIF(EXCLUDED.name, ''), public.racks.name)
    RETURNING id INTO v_rack_id;

    INSERT INTO public.boxes (rack_id, code, name, created_by)
    VALUES (
      v_rack_id,
      v_box_code,
      NULLIF(btrim(COALESCE(v_row->>'box_name', '')), ''),
      auth.uid()
    )
    ON CONFLICT (rack_id, code) DO UPDATE
    SET name = COALESCE(NULLIF(EXCLUDED.name, ''), public.boxes.name)
    RETURNING id INTO v_box_id;

    v_part_id := NULL;
    IF v_mpn <> '' THEN
      SELECT p.id
      INTO v_part_id
      FROM public.parts p
      WHERE lower(p.mpn) = lower(v_mpn)
      ORDER BY p.created_at
      LIMIT 1;
    END IF;

    IF v_part_id IS NULL THEN
      SELECT p.id
      INTO v_part_id
      FROM public.parts p
      WHERE lower(p.name) = lower(v_part_name)
        AND (v_mpn = '' OR p.mpn IS NULL OR btrim(p.mpn) = '')
      ORDER BY p.created_at
      LIMIT 1;
    END IF;

    IF v_part_id IS NULL THEN
      INSERT INTO public.parts (
        name,
        description,
        mpn,
        footprint,
        vendor_id,
        unit_cost,
        qty_available,
        storage_location
      )
      VALUES (
        v_part_name,
        NULLIF(btrim(COALESCE(v_row->>'description', '')), ''),
        NULLIF(v_mpn, ''),
        NULLIF(btrim(COALESCE(v_row->>'footprint', '')), ''),
        v_vendor_id,
        v_unit_cost,
        0,
        v_rack_code || ' / ' || v_box_code
      )
      RETURNING id INTO v_part_id;
    ELSE
      UPDATE public.parts
      SET
        name = v_part_name,
        description = COALESCE(NULLIF(btrim(COALESCE(v_row->>'description', '')), ''), description),
        mpn = COALESCE(NULLIF(v_mpn, ''), mpn),
        footprint = COALESCE(NULLIF(btrim(COALESCE(v_row->>'footprint', '')), ''), footprint),
        vendor_id = COALESCE(v_vendor_id, vendor_id),
        unit_cost = CASE
          WHEN btrim(COALESCE(v_row->>'unit_cost', '')) = '' THEN unit_cost
          ELSE v_unit_cost
        END,
        storage_location = v_rack_code || ' / ' || v_box_code
      WHERE id = v_part_id;
    END IF;

    INSERT INTO public.part_locations (part_id, box_id, qty)
    VALUES (v_part_id, v_box_id, v_qty)
    ON CONFLICT (part_id, box_id) DO UPDATE
    SET
      qty = EXCLUDED.qty,
      updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('imported', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.import_inventory_rows(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_inventory_rows(JSONB) TO authenticated;
