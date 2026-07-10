import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createServiceClient } from '../_shared/notify.ts';
import { sendZohoEmail } from '../_shared/smtp.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const payloadSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  event_type: z.enum([
    'task_assigned',
    'step_completed',
    'qc_failed',
    'low_stock',
    'damage_reported',
  ]),
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request): boolean {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const invokeSecret = Deno.env.get('NOTIFY_INVOKE_SECRET');

  return token === serviceRoleKey || (!!invokeSecret && token === invokeSecret);
}

async function sendSmtpEmailWithSingleRetry(to: string, subject: string, body: string) {
  try {
    await sendZohoEmail(to, subject, body);
    return;
  } catch (firstError) {
    console.error('SMTP send failed (attempt 1)', firstError);
    try {
      await sendZohoEmail(to, subject, body);
    } catch (secondError) {
      console.error('SMTP send failed (attempt 2)', secondError);
      throw secondError;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const parsed = payloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
    }

    const normalizedEmail = parsed.data.to.toLowerCase().trim();

    try {
      await sendSmtpEmailWithSingleRetry(normalizedEmail, parsed.data.subject, parsed.data.body);
    } catch (smtpError) {
      const message = smtpError instanceof Error ? smtpError.message : 'SMTP send failed';
      console.error('send-notification-email SMTP error', message);
      return jsonResponse({ error: message }, 502);
    }

    const adminClient = createServiceClient();
    const { data: userRow, error: userError } = await adminClient
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('active', true)
      .maybeSingle();

    if (userError) {
      console.error('send-notification-email user lookup failed', userError.message);
      return jsonResponse({ ok: true, email_sent: true, logged: false });
    }

    if (!userRow) {
      console.warn('send-notification-email: no active user for email', normalizedEmail);
      return jsonResponse({ ok: true, email_sent: true, logged: false });
    }

    const { error: logError } = await adminClient.from('notifications_log').insert({
      user_id: userRow.id,
      event_type: parsed.data.event_type,
      channel: 'email',
    });

    if (logError) {
      console.error('notifications_log insert failed', logError.message);
      return jsonResponse({ ok: true, email_sent: true, logged: false, log_error: logError.message });
    }

    return jsonResponse({ ok: true, email_sent: true, logged: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('send-notification-email unhandled error', message);
    return jsonResponse({ error: message }, 500);
  }
});
