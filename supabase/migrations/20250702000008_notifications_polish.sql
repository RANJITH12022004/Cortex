-- Prompt 5 — notifications, push subscriptions, low-stock threshold, sheet backup cursors

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(12, 3) NOT NULL DEFAULT 5;

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);

CREATE TABLE public.sheet_backup_cursors (
  table_name TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z'
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_backup_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY push_subscriptions_select_admin ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY sheet_backup_cursors_select_admin ON public.sheet_backup_cursors
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Managers can read all notifications for oversight
CREATE POLICY notifications_log_select_manager ON public.notifications_log
  FOR SELECT TO authenticated
  USING (public.is_manager());
