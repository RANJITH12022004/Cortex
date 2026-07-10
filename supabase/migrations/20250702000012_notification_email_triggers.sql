-- Database triggers that dispatch transactional email via send-notification-email Edge Function.
-- Requires pg_net and a vault secret named notify_invoke_secret (same value as NOTIFY_INVOKE_SECRET).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.facman_functions_base_url()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.facman_supabase_url', true), ''),
    'https://ttgquwvfpknqlfrnfksk.supabase.co'
  );
$$;

CREATE OR REPLACE FUNCTION public.dispatch_notification_email(
  p_to TEXT,
  p_subject TEXT,
  p_body TEXT,
  p_event_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_payload JSONB;
BEGIN
  IF p_to IS NULL OR btrim(p_to) = '' THEN
    RETURN;
  END IF;

  BEGIN
    SELECT decrypted_secret
    INTO v_token
    FROM vault.decrypted_secrets
    WHERE name = 'notify_invoke_secret'
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      v_token := NULL;
  END;

  IF v_token IS NULL OR v_token = '' THEN
    RAISE LOG 'dispatch_notification_email skipped (%): notify_invoke_secret missing', p_event_type;
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'to', lower(btrim(p_to)),
    'subject', p_subject,
    'body', p_body,
    'event_type', p_event_type
  );

  PERFORM net.http_post(
    url := rtrim(public.facman_functions_base_url(), '/') || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := v_payload
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_role_emails(
  p_roles public.user_role[],
  p_subject TEXT,
  p_body TEXT,
  p_event_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient RECORD;
BEGIN
  FOR v_recipient IN
    SELECT email
    FROM public.users
    WHERE role = ANY (p_roles)
      AND active = TRUE
  LOOP
    PERFORM public.dispatch_notification_email(
      v_recipient.email,
      p_subject,
      p_body,
      p_event_type
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_serials_task_assigned_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignee_email TEXT;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT email
  INTO v_assignee_email
  FROM public.users
  WHERE id = NEW.assigned_to
    AND active = TRUE;

  IF v_assignee_email IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.dispatch_notification_email(
    v_assignee_email,
    'Task assigned: assembly',
    format(
      'You were assigned assembly for serial %s.',
      NEW.serial_number
    ),
    'task_assigned'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_serial_steps_completed_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_serial_number TEXT;
BEGIN
  IF NEW.status NOT IN ('completed', 'done') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT serial_number
  INTO v_serial_number
  FROM public.serials
  WHERE id = NEW.serial_id;

  PERFORM public.notify_role_emails(
    ARRAY['manager', 'senior_manager']::public.user_role[],
    format('Step completed: %s', NEW.step_name),
    format(
      'Serial %s — step "%s" marked complete.',
      COALESCE(v_serial_number, NEW.serial_id::TEXT),
      NEW.step_name
    ),
    'step_completed'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_qc_failed_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_serial_number TEXT;
BEGIN
  IF NEW.result <> 'fail' THEN
    RETURN NEW;
  END IF;

  SELECT serial_number
  INTO v_serial_number
  FROM public.serials
  WHERE id = NEW.serial_id;

  PERFORM public.notify_role_emails(
    ARRAY['manager', 'senior_manager']::public.user_role[],
    format('QC failed: %s', COALESCE(v_serial_number, 'unit')),
    format(
      'Serial %s failed QC at checkpoint "%s" and was routed to rework.',
      COALESCE(v_serial_number, NEW.serial_id::TEXT),
      NEW.checkpoint_name
    ),
    'qc_failed'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_parts_low_stock_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold NUMERIC;
  v_was_above BOOLEAN;
  v_is_below BOOLEAN;
BEGIN
  v_threshold := COALESCE(NEW.low_stock_threshold, 5);
  v_was_above := TG_OP = 'INSERT' OR COALESCE(OLD.qty_available, 0) > v_threshold;
  v_is_below := NEW.qty_available <= v_threshold;

  IF NOT (v_was_above AND v_is_below) THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_role_emails(
    ARRAY['procurement', 'manager', 'senior_manager']::public.user_role[],
    format('Low stock: %s', NEW.name),
    format(
      '%s is at %s units (threshold %s). Review procurement.',
      NEW.name,
      NEW.qty_available,
      v_threshold
    ),
    'low_stock'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_damage_reported_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_serial_number TEXT;
  v_part_name TEXT;
BEGIN
  SELECT s.serial_number, p.name
  INTO v_serial_number, v_part_name
  FROM public.serials s
  JOIN public.parts p ON p.id = NEW.part_id
  WHERE s.id = NEW.serial_id;

  PERFORM public.notify_role_emails(
    ARRAY['procurement']::public.user_role[],
    format('Damage reported: %s', COALESCE(v_part_name, 'part')),
    format(
      '%s on serial %s: %s',
      COALESCE(v_part_name, 'Part'),
      COALESCE(v_serial_number, NEW.serial_id::TEXT),
      NEW.reason
    ),
    'damage_reported'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS serials_task_assigned_email ON public.serials;
CREATE TRIGGER serials_task_assigned_email
AFTER INSERT ON public.serials
FOR EACH ROW
EXECUTE FUNCTION public.trg_serials_task_assigned_email();

DROP TRIGGER IF EXISTS serial_steps_completed_email ON public.serial_steps;
CREATE TRIGGER serial_steps_completed_email
AFTER INSERT OR UPDATE OF status ON public.serial_steps
FOR EACH ROW
EXECUTE FUNCTION public.trg_serial_steps_completed_email();

DROP TRIGGER IF EXISTS qc_results_failed_email ON public.qc_results;
CREATE TRIGGER qc_results_failed_email
AFTER INSERT ON public.qc_results
FOR EACH ROW
EXECUTE FUNCTION public.trg_qc_failed_email();

DROP TRIGGER IF EXISTS parts_low_stock_email ON public.parts;
CREATE TRIGGER parts_low_stock_email
AFTER INSERT OR UPDATE OF qty_available, low_stock_threshold ON public.parts
FOR EACH ROW
EXECUTE FUNCTION public.trg_parts_low_stock_email();

DROP TRIGGER IF EXISTS damage_reports_reported_email ON public.damage_reports;
CREATE TRIGGER damage_reports_reported_email
AFTER INSERT ON public.damage_reports
FOR EACH ROW
EXECUTE FUNCTION public.trg_damage_reported_email();

GRANT EXECUTE ON FUNCTION public.facman_functions_base_url() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_notification_email(TEXT, TEXT, TEXT, TEXT) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.notify_role_emails(public.user_role[], TEXT, TEXT, TEXT) TO postgres, service_role;
