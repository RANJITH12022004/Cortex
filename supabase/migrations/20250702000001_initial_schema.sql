-- Cortex initial schema (PRD section 4)

-- Enums
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'procurement', 'employee');

CREATE TYPE public.pr_status AS ENUM (
  'pending_check',
  'ready',
  'procurement_hold',
  'assigned',
  'in_progress',
  'qc',
  'packing',
  'delivery',
  'installed',
  'done'
);

CREATE TYPE public.qc_result_value AS ENUM ('pass', 'fail');

CREATE TYPE public.notification_channel AS ENUM ('email', 'push');

-- Users (extends auth.users; role set by invite Edge Function)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role public.user_role NOT NULL,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_role_idx ON public.users (role);
CREATE INDEX users_created_by_idx ON public.users (created_by);

-- Vendors
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX vendors_name_idx ON public.vendors (name);

-- Parts
CREATE TABLE public.parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  mpn TEXT,
  footprint TEXT,
  vendor_id UUID REFERENCES public.vendors (id) ON DELETE SET NULL,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  qty_available NUMERIC(12, 3) NOT NULL DEFAULT 0,
  storage_location TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX parts_vendor_id_idx ON public.parts (vendor_id);
CREATE INDEX parts_name_idx ON public.parts (name);
CREATE INDEX parts_mpn_idx ON public.parts (mpn);

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX products_created_by_idx ON public.products (created_by);
CREATE INDEX products_name_idx ON public.products (name);

-- BOM
CREATE TABLE public.bom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts (id) ON DELETE RESTRICT,
  qty_required NUMERIC(12, 3) NOT NULL CHECK (qty_required > 0),
  UNIQUE (product_id, part_id)
);

CREATE INDEX bom_product_id_idx ON public.bom (product_id);
CREATE INDEX bom_part_id_idx ON public.bom (part_id);

-- Assembly templates
CREATE TABLE public.assembly_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL CHECK (step_order > 0),
  step_name TEXT NOT NULL,
  UNIQUE (product_id, step_order)
);

CREATE INDEX assembly_templates_product_id_idx ON public.assembly_templates (product_id);

-- QC templates
CREATE TABLE public.qc_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  checkpoint_order INTEGER NOT NULL CHECK (checkpoint_order > 0),
  checkpoint_name TEXT NOT NULL,
  UNIQUE (product_id, checkpoint_order)
);

CREATE INDEX qc_templates_product_id_idx ON public.qc_templates (product_id);

-- Purchase requests
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  priority INTEGER NOT NULL DEFAULT 0,
  status public.pr_status NOT NULL DEFAULT 'pending_check',
  created_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX purchase_requests_status_idx ON public.purchase_requests (status);
CREATE INDEX purchase_requests_priority_idx ON public.purchase_requests (priority DESC);
CREATE INDEX purchase_requests_product_id_idx ON public.purchase_requests (product_id);

-- Serials (traceability spine)
CREATE TABLE public.serials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id UUID NOT NULL REFERENCES public.purchase_requests (id) ON DELETE RESTRICT,
  serial_number TEXT NOT NULL UNIQUE,
  assigned_to UUID REFERENCES public.users (id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  current_stage TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX serials_pr_id_idx ON public.serials (pr_id);
CREATE INDEX serials_assigned_to_idx ON public.serials (assigned_to);
CREATE INDEX serials_serial_number_idx ON public.serials (serial_number);

-- Serial steps (one row per assembly step, live-updated)
CREATE TABLE public.serial_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL REFERENCES public.serials (id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  done_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (serial_id, step_name)
);

CREATE INDEX serial_steps_serial_id_idx ON public.serial_steps (serial_id);

-- QC results
CREATE TABLE public.qc_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL REFERENCES public.serials (id) ON DELETE CASCADE,
  checkpoint_name TEXT NOT NULL,
  result public.qc_result_value NOT NULL,
  note TEXT,
  checked_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX qc_results_serial_id_idx ON public.qc_results (serial_id);

-- Attachments (Drive links)
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL REFERENCES public.serials (id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  drive_link TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX attachments_serial_id_idx ON public.attachments (serial_id);

-- Material handover (two-sided confirmation)
CREATE TABLE public.material_handover (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL REFERENCES public.serials (id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts (id) ON DELETE RESTRICT,
  qty NUMERIC(12, 3) NOT NULL CHECK (qty > 0),
  issued_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ
);

CREATE INDEX material_handover_serial_id_idx ON public.material_handover (serial_id);
CREATE INDEX material_handover_part_id_idx ON public.material_handover (part_id);

-- Damage reports
CREATE TABLE public.damage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL REFERENCES public.serials (id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.parts (id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  reported_by UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replacement_issued_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  replacement_issued_at TIMESTAMPTZ
);

CREATE INDEX damage_reports_serial_id_idx ON public.damage_reports (serial_id);

-- Remarks (append-only audit log)
CREATE TABLE public.remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL REFERENCES public.serials (id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  author UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX remarks_serial_id_idx ON public.remarks (serial_id);

-- Delivery & installation
CREATE TABLE public.delivery_install (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_id UUID NOT NULL UNIQUE REFERENCES public.serials (id) ON DELETE CASCADE,
  delivery_partner TEXT,
  delivery_docs_link TEXT,
  installed_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  installation_docs_link TEXT,
  installed_at TIMESTAMPTZ
);

-- Notifications log
CREATE TABLE public.notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel public.notification_channel NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_log_user_id_idx ON public.notifications_log (user_id);

-- Helper: check if user is assigned to a serial
CREATE OR REPLACE FUNCTION public.is_assigned_to_serial(p_serial_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.serials s
    WHERE s.id = p_serial_id
      AND s.assigned_to = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_assigned_to_serial(UUID) TO authenticated;
