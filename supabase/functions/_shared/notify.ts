import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import webpush from 'https://esm.sh/web-push@3.6.7';
import { sendZohoEmail } from './smtp.ts';

export type NotificationEventType =
  | 'task_assigned'
  | 'step_completed'
  | 'qc_failed'
  | 'low_stock'
  | 'damage_reported';

type NotifyInput = {
  userId: string;
  eventType: NotificationEventType;
  subject: string;
  body: string;
  url?: string;
};

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return;
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:cortex@example.com';
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
}

async function sendEmail(to: string, subject: string, body: string) {
  try {
    await sendZohoEmail(to, subject, body);
    return true;
  } catch (error) {
    console.warn('SMTP send failed; skipping email', error);
    return false;
  }
}

async function sendPush(
  subscriptions: PushSubscriptionRow[],
  payload: { title: string; body: string; url?: string },
) {
  configureVapid();
  if (!vapidConfigured || subscriptions.length === 0) return false;

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
  });

  let sent = false;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        data,
      );
      sent = true;
    } catch (error) {
      console.error('Push failed for endpoint', sub.endpoint, error);
    }
  }
  return sent;
}

async function logNotification(
  adminClient: SupabaseClient,
  userId: string,
  eventType: NotificationEventType,
  channel: 'email' | 'push',
) {
  const { error } = await adminClient.from('notifications_log').insert({
    user_id: userId,
    event_type: eventType,
    channel,
  });
  if (error) console.error('notifications_log insert failed', error.message);
}

export async function notifyUser(adminClient: SupabaseClient, input: NotifyInput) {
  const { data: userRow, error } = await adminClient
    .from('users')
    .select('id, email, active')
    .eq('id', input.userId)
    .single();

  if (error || !userRow?.active) {
    console.warn('notifyUser: user not found or inactive', input.userId);
    return;
  }

  const { data: subs } = await adminClient
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', input.userId);

  const emailSent = await sendEmail(userRow.email, input.subject, input.body);
  if (emailSent) {
    await logNotification(adminClient, input.userId, input.eventType, 'email');
  }

  const pushSent = await sendPush((subs ?? []) as PushSubscriptionRow[], {
    title: input.subject,
    body: input.body,
    url: input.url,
  });
  if (pushSent) {
    await logNotification(adminClient, input.userId, input.eventType, 'push');
  }
}

export async function notifyRoleUsers(
  adminClient: SupabaseClient,
  role: 'manager' | 'procurement',
  input: Omit<NotifyInput, 'userId'>,
) {
  const { data: users } = await adminClient
    .from('users')
    .select('id')
    .eq('role', role)
    .eq('active', true);

  for (const user of users ?? []) {
    await notifyUser(adminClient, { ...input, userId: user.id });
  }
}

export async function checkLowStockAndNotify(adminClient: SupabaseClient, partId: string) {
  const { data: part } = await adminClient
    .from('parts')
    .select('id, name, qty_available, low_stock_threshold')
    .eq('id', partId)
    .single();

  if (!part) return;

  const available = Number(part.qty_available);
  const threshold = Number(part.low_stock_threshold ?? 5);
  if (available > threshold) return;

  const subject = `Low stock: ${part.name}`;
  const body = `${part.name} is at ${available} units (threshold ${threshold}). Review procurement.`;

  await notifyRoleUsers(adminClient, 'procurement', {
    eventType: 'low_stock',
    subject,
    body,
    url: '/procurement',
  });
  await notifyRoleUsers(adminClient, 'manager', {
    eventType: 'low_stock',
    subject,
    body,
    url: '/inventory',
  });
}

export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server configuration error');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
