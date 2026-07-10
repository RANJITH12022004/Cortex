-- Rich per-product form definitions (Google Forms-style) + admin parts access.

CREATE TABLE public.product_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  form_type TEXT NOT NULL CHECK (form_type IN ('assembly', 'qc', 'installation')),
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  definition JSONB NOT NULL DEFAULT '{"fields":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, form_type)
);

CREATE INDEX product_forms_product_id_idx ON public.product_forms (product_id);

CREATE TRIGGER product_forms_set_updated_at
  BEFORE UPDATE ON public.product_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_forms_select_staff ON public.product_forms
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY product_forms_insert_manager ON public.product_forms
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY product_forms_update_manager ON public.product_forms
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

CREATE POLICY product_forms_delete_manager ON public.product_forms
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- Admin and managers can manage the parts catalog.
DROP POLICY IF EXISTS parts_insert_procurement ON public.parts;
DROP POLICY IF EXISTS parts_update_procurement ON public.parts;

CREATE POLICY parts_insert_staff ON public.parts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_procurement() OR public.is_manager_or_admin());

CREATE POLICY parts_update_staff ON public.parts
  FOR UPDATE TO authenticated
  USING (public.is_procurement() OR public.is_manager_or_admin())
  WITH CHECK (public.is_procurement() OR public.is_manager_or_admin());
