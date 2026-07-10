import { supabase } from '@/lib/supabase';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerPushSubscription() {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false as const, reason: 'unsupported' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false as const, reason: 'denied' };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false as const, reason: 'invalid_subscription' };
  }

  const { data, error } = await supabase.functions.invoke('register-push', {
    body: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { ok: true as const };
}

export async function dispatchWorkflowNotification(
  payload:
    | { eventType: 'step_completed'; serialId: string; stepName: string }
    | { eventType: 'qc_failed'; serialId: string }
    | { eventType: 'damage_reported'; damageReportId: string },
) {
  const { data, error } = await supabase.functions.invoke('workflow-notify', { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function listMyNotifications(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('notifications_log')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
