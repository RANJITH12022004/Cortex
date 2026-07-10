-- Repair auth ↔ profile linkage and consolidate manager/admin RLS helpers.

-- Backfill public.users for any auth.users row missing a profile (invite-only signup).
INSERT INTO public.users (id, email, role, created_by, active)
SELECT
  au.id,
  lower(trim(au.email)),
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.users existing
      WHERE existing.role = 'admin' AND existing.active = TRUE
    )
    THEN 'employee'::public.user_role
    ELSE 'admin'::public.user_role
  END,
  NULL,
  TRUE
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
  AND au.email IS NOT NULL
  AND trim(au.email) <> ''
ON CONFLICT (id) DO NOTHING;

-- Re-activate admin accounts that were accidentally deactivated.
UPDATE public.users
SET active = TRUE
WHERE role = 'admin'
  AND active = FALSE;

-- Admin, manager, and senior_manager share manager-level permissions.
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_role() IN ('admin', 'manager', 'senior_manager');
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_role() IN ('admin', 'manager', 'senior_manager');
$$;

-- Users can always read their own profile row (even when inactive).
DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- product_forms: allow admin via is_manager() above; widen policies explicitly.
DROP POLICY IF EXISTS product_forms_insert_manager ON public.product_forms;
DROP POLICY IF EXISTS product_forms_update_manager ON public.product_forms;
DROP POLICY IF EXISTS product_forms_delete_manager ON public.product_forms;

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
