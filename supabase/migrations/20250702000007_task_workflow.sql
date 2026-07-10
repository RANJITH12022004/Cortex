-- Prompt 4 - task workflow, QC, and attachments

CREATE TYPE public.task_type AS ENUM (
  'assembly',
  'qc',
  'packing',
  'delivery',
  'installation'
);

CREATE TABLE public.serial_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL REFERENCES public.serials (id) ON DELETE CASCADE,
  task_type public.task_type NOT NULL,
  assigned_to UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  assigned_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (serial_id, task_type, assigned_to, assigned_at)
);

CREATE INDEX serial_assignments_serial_id_idx ON public.serial_assignments (serial_id);
CREATE INDEX serial_assignments_assigned_to_idx ON public.serial_assignments (assigned_to);
CREATE INDEX serial_assignments_task_type_idx ON public.serial_assignments (task_type);

ALTER TABLE public.serials
  ADD COLUMN current_task_type public.task_type,
  ADD COLUMN packed_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN packed_at TIMESTAMPTZ;

ALTER TABLE public.attachments
  ADD COLUMN task_type public.task_type,
  ADD COLUMN checkpoint_name TEXT;

CREATE INDEX attachments_task_type_idx ON public.attachments (task_type);
CREATE INDEX attachments_checkpoint_name_idx ON public.attachments (checkpoint_name);

ALTER TABLE public.delivery_install
  ADD COLUMN delivered_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN delivered_at TIMESTAMPTZ;

ALTER TABLE public.serial_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY serial_assignments_select_staff ON public.serial_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.is_procurement()
    OR assigned_to = auth.uid()
  );

CREATE POLICY serial_assignments_insert_manager ON public.serial_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND assigned_by = auth.uid());

CREATE POLICY serial_assignments_update_manager ON public.serial_assignments
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE POLICY serial_assignments_update_assigned ON public.serial_assignments
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.serials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.serial_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.serial_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qc_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.remarks;

CREATE OR REPLACE FUNCTION public.get_open_assignment(
  p_serial_id UUID,
  p_task_type public.task_type
)
RETURNS public.serial_assignments
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.*
  FROM public.serial_assignments sa
  WHERE sa.serial_id = p_serial_id
    AND sa.task_type = p_task_type
    AND sa.completed_at IS NULL
  ORDER BY sa.assigned_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_open_assignment(UUID, public.task_type) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_purchase_request(
  p_request_id UUID,
  p_assigned_to UUID,
  p_assigned_by UUID
)
RETURNS SETOF public.serials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.purchase_requests;
  v_product public.products;
  v_serial public.serials;
  v_idx INTEGER;
  v_existing_count INTEGER;
BEGIN
  SELECT *
  INTO v_request
  FROM public.purchase_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase request not found';
  END IF;

  IF v_request.status NOT IN ('ready', 'assigned') THEN
    RAISE EXCEPTION 'Only ready requests can be assigned';
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = v_request.product_id;

  SELECT COUNT(*)
  INTO v_existing_count
  FROM public.serials
  WHERE pr_id = p_request_id;

  IF v_existing_count = 0 THEN
    FOR v_idx IN 1..v_request.qty LOOP
      INSERT INTO public.serials (
        pr_id,
        serial_number,
        assigned_to,
        assigned_by,
        priority,
        current_stage,
        current_task_type
      )
      VALUES (
        p_request_id,
        CONCAT(UPPER(LEFT(REGEXP_REPLACE(COALESCE(v_product.name, 'SERIAL'), '[^A-Za-z0-9]', '', 'g'), 4)), '-', LPAD(v_idx::TEXT, 3, '0'), '-', SUBSTRING(REPLACE(p_request_id::TEXT, '-', '') FROM 1 FOR 6)),
        p_assigned_to,
        p_assigned_by,
        v_request.priority,
        'assembly',
        'assembly'
      )
      RETURNING * INTO v_serial;

      INSERT INTO public.serial_assignments (
        serial_id,
        task_type,
        assigned_to,
        assigned_by
      )
      VALUES (
        v_serial.id,
        'assembly',
        p_assigned_to,
        p_assigned_by
      );

      INSERT INTO public.serial_steps (
        serial_id,
        step_name,
        status
      )
      SELECT
        v_serial.id,
        at.step_name,
        'pending'
      FROM public.assembly_templates at
      WHERE at.product_id = v_request.product_id
      ORDER BY at.step_order;
    END LOOP;
  ELSE
    UPDATE public.serials
    SET
      assigned_to = p_assigned_to,
      assigned_by = p_assigned_by,
      current_task_type = 'assembly',
      current_stage = 'assembly'
    WHERE pr_id = p_request_id
      AND current_task_type IS NULL;

    INSERT INTO public.serial_assignments (
      serial_id,
      task_type,
      assigned_to,
      assigned_by
    )
    SELECT
      s.id,
      'assembly',
      p_assigned_to,
      p_assigned_by
    FROM public.serials s
    WHERE s.pr_id = p_request_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.serial_assignments sa
        WHERE sa.serial_id = s.id
          AND sa.task_type = 'assembly'
          AND sa.completed_at IS NULL
      );
  END IF;

  UPDATE public.purchase_requests
  SET status = 'assigned'
  WHERE id = p_request_id;

  RETURN QUERY
    SELECT *
    FROM public.serials
    WHERE pr_id = p_request_id
    ORDER BY created_at, serial_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_serial_stage(
  p_serial_id UUID,
  p_task_type public.task_type,
  p_assigned_to UUID,
  p_assigned_by UUID
)
RETURNS public.serial_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_serial public.serials;
  v_result public.serial_assignments;
BEGIN
  SELECT *
  INTO v_serial
  FROM public.serials
  WHERE id = p_serial_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serial not found';
  END IF;

  IF p_task_type = 'qc' AND v_serial.assigned_to = p_assigned_to THEN
    RAISE EXCEPTION 'QC must be assigned to a different employee than assembly';
  END IF;

  UPDATE public.serial_assignments
  SET completed_at = COALESCE(completed_at, NOW())
  WHERE serial_id = p_serial_id
    AND completed_at IS NULL;

  INSERT INTO public.serial_assignments (
    serial_id,
    task_type,
    assigned_to,
    assigned_by
  )
  VALUES (
    p_serial_id,
    p_task_type,
    p_assigned_to,
    p_assigned_by
  )
  RETURNING * INTO v_result;

  UPDATE public.serials
  SET
    assigned_to = p_assigned_to,
    assigned_by = p_assigned_by,
    current_task_type = p_task_type,
    current_stage = p_task_type::TEXT
  WHERE id = p_serial_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_serial_assignment(
  p_serial_id UUID,
  p_task_type public.task_type,
  p_actor UUID,
  p_next_stage TEXT
)
RETURNS public.serials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.serials;
BEGIN
  UPDATE public.serial_assignments
  SET completed_at = COALESCE(completed_at, NOW())
  WHERE serial_id = p_serial_id
    AND task_type = p_task_type
    AND assigned_to = p_actor
    AND completed_at IS NULL;

  UPDATE public.serials
  SET current_stage = p_next_stage
  WHERE id = p_serial_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_purchase_request(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_serial_stage(UUID, public.task_type, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_serial_assignment(UUID, public.task_type, UUID, TEXT) TO authenticated;
