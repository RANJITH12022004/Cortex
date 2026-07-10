-- Enable RLS on every table (default deny — no policy = no access)

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembly_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serial_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_handover ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_install ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE POLICY users_select_self ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY users_select_admin ON public.users
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY users_select_manager_team ON public.users
  FOR SELECT TO authenticated
  USING (
    public.is_manager()
    AND role IN ('employee', 'procurement')
  );

CREATE POLICY users_update_admin ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY users_update_manager_team ON public.users
  FOR UPDATE TO authenticated
  USING (
    public.is_manager()
    AND role IN ('employee', 'procurement')
  )
  WITH CHECK (
    public.is_manager()
    AND role IN ('employee', 'procurement')
  );

-- Inserts handled by invite-user Edge Function (service role bypasses RLS)

-- ---------------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------------
CREATE POLICY vendors_select_staff ON public.vendors
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY vendors_insert_manager ON public.vendors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY vendors_update_manager ON public.vendors
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE POLICY vendors_delete_manager ON public.vendors
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ---------------------------------------------------------------------------
-- parts
-- ---------------------------------------------------------------------------
CREATE POLICY parts_select_staff ON public.parts
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY parts_insert_procurement ON public.parts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_procurement() OR public.is_manager());

CREATE POLICY parts_update_procurement ON public.parts
  FOR UPDATE TO authenticated
  USING (public.is_procurement() OR public.is_manager())
  WITH CHECK (public.is_procurement() OR public.is_manager());

CREATE POLICY parts_delete_manager ON public.parts
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE POLICY products_select_staff ON public.products
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY products_insert_manager ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND created_by = auth.uid());

CREATE POLICY products_update_manager ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE POLICY products_delete_manager ON public.products
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ---------------------------------------------------------------------------
-- bom
-- ---------------------------------------------------------------------------
CREATE POLICY bom_select_staff ON public.bom
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY bom_insert_manager ON public.bom
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY bom_update_manager ON public.bom
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE POLICY bom_delete_manager ON public.bom
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ---------------------------------------------------------------------------
-- assembly_templates
-- ---------------------------------------------------------------------------
CREATE POLICY assembly_templates_select_staff ON public.assembly_templates
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY assembly_templates_insert_manager ON public.assembly_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY assembly_templates_update_manager ON public.assembly_templates
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE POLICY assembly_templates_delete_manager ON public.assembly_templates
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ---------------------------------------------------------------------------
-- qc_templates
-- ---------------------------------------------------------------------------
CREATE POLICY qc_templates_select_staff ON public.qc_templates
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY qc_templates_insert_manager ON public.qc_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY qc_templates_update_manager ON public.qc_templates
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE POLICY qc_templates_delete_manager ON public.qc_templates
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ---------------------------------------------------------------------------
-- purchase_requests
-- ---------------------------------------------------------------------------
CREATE POLICY purchase_requests_select_manager_admin ON public.purchase_requests
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_procurement());

CREATE POLICY purchase_requests_select_employee_assigned ON public.purchase_requests
  FOR SELECT TO authenticated
  USING (
    public.is_employee()
    AND EXISTS (
      SELECT 1
      FROM public.serials s
      WHERE s.pr_id = purchase_requests.id
        AND s.assigned_to = auth.uid()
    )
  );

CREATE POLICY purchase_requests_insert_manager ON public.purchase_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND created_by = auth.uid());

CREATE POLICY purchase_requests_update_manager ON public.purchase_requests
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- ---------------------------------------------------------------------------
-- serials
-- ---------------------------------------------------------------------------
CREATE POLICY serials_select_manager_admin ON public.serials
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_procurement());

CREATE POLICY serials_select_assigned_employee ON public.serials
  FOR SELECT TO authenticated
  USING (public.is_employee() AND assigned_to = auth.uid());

CREATE POLICY serials_insert_manager ON public.serials
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY serials_update_manager ON public.serials
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE POLICY serials_update_assigned_employee ON public.serials
  FOR UPDATE TO authenticated
  USING (public.is_employee() AND assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- ---------------------------------------------------------------------------
-- serial_steps
-- ---------------------------------------------------------------------------
CREATE POLICY serial_steps_select_manager_admin ON public.serial_steps
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_procurement());

CREATE POLICY serial_steps_select_assigned ON public.serial_steps
  FOR SELECT TO authenticated
  USING (public.is_assigned_to_serial(serial_id));

CREATE POLICY serial_steps_insert_manager ON public.serial_steps
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY serial_steps_insert_assigned ON public.serial_steps
  FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_to_serial(serial_id));

CREATE POLICY serial_steps_update_manager ON public.serial_steps
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE POLICY serial_steps_update_assigned ON public.serial_steps
  FOR UPDATE TO authenticated
  USING (public.is_assigned_to_serial(serial_id))
  WITH CHECK (public.is_assigned_to_serial(serial_id));

-- ---------------------------------------------------------------------------
-- qc_results
-- ---------------------------------------------------------------------------
CREATE POLICY qc_results_select_manager_admin ON public.qc_results
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_procurement());

CREATE POLICY qc_results_select_assigned ON public.qc_results
  FOR SELECT TO authenticated
  USING (public.is_assigned_to_serial(serial_id));

CREATE POLICY qc_results_insert_assigned ON public.qc_results
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_assigned_to_serial(serial_id)
    AND checked_by = auth.uid()
  );

CREATE POLICY qc_results_insert_manager ON public.qc_results
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND checked_by = auth.uid());

-- ---------------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------------
CREATE POLICY attachments_select_staff ON public.attachments
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY attachments_insert_assigned ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_assigned_to_serial(serial_id)
    AND uploaded_by = auth.uid()
  );

CREATE POLICY attachments_insert_manager ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND uploaded_by = auth.uid());

CREATE POLICY attachments_update_admin ON public.attachments
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY attachments_delete_admin ON public.attachments
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- material_handover
-- ---------------------------------------------------------------------------
CREATE POLICY material_handover_select_staff ON public.material_handover
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.is_procurement()
    OR public.is_assigned_to_serial(serial_id)
  );

CREATE POLICY material_handover_insert_procurement ON public.material_handover
  FOR INSERT TO authenticated
  WITH CHECK (public.is_procurement() AND issued_by = auth.uid());

CREATE POLICY material_handover_update_procurement ON public.material_handover
  FOR UPDATE TO authenticated
  USING (public.is_procurement())
  WITH CHECK (public.is_procurement());

CREATE POLICY material_handover_update_employee_confirm ON public.material_handover
  FOR UPDATE TO authenticated
  USING (
    public.is_employee()
    AND public.is_assigned_to_serial(serial_id)
    AND received_by IS NULL
  )
  WITH CHECK (
    received_by = auth.uid()
    AND public.is_assigned_to_serial(serial_id)
  );

-- ---------------------------------------------------------------------------
-- damage_reports
-- ---------------------------------------------------------------------------
CREATE POLICY damage_reports_select_staff ON public.damage_reports
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.is_procurement()
    OR public.is_assigned_to_serial(serial_id)
  );

CREATE POLICY damage_reports_insert_employee ON public.damage_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_assigned_to_serial(serial_id)
    AND reported_by = auth.uid()
  );

CREATE POLICY damage_reports_update_procurement ON public.damage_reports
  FOR UPDATE TO authenticated
  USING (public.is_procurement())
  WITH CHECK (public.is_procurement());

-- ---------------------------------------------------------------------------
-- remarks (append-only: SELECT + INSERT only, no UPDATE/DELETE)
-- ---------------------------------------------------------------------------
CREATE POLICY remarks_select_staff ON public.remarks
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY remarks_insert_assigned ON public.remarks
  FOR INSERT TO authenticated
  WITH CHECK (
    author = auth.uid()
    AND (
      public.is_manager_or_admin()
      OR public.is_procurement()
      OR public.is_assigned_to_serial(serial_id)
    )
  );

-- ---------------------------------------------------------------------------
-- delivery_install
-- ---------------------------------------------------------------------------
CREATE POLICY delivery_install_select_staff ON public.delivery_install
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY delivery_install_insert_assigned ON public.delivery_install
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_assigned_to_serial(serial_id)
    OR public.is_manager()
  );

CREATE POLICY delivery_install_update_assigned ON public.delivery_install
  FOR UPDATE TO authenticated
  USING (
    public.is_manager()
    OR public.is_assigned_to_serial(serial_id)
  )
  WITH CHECK (
    public.is_manager()
    OR public.is_assigned_to_serial(serial_id)
  );

-- ---------------------------------------------------------------------------
-- notifications_log
-- ---------------------------------------------------------------------------
CREATE POLICY notifications_log_select_own ON public.notifications_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_log_select_admin ON public.notifications_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Inserts via Edge Functions (service role) in later phases
