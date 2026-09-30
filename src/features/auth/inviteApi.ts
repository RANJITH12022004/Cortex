import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/database';

export async function inviteUser(input: { email: string; role: UserRole }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('You must be signed in to invite users.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Unable to send invitation. Please try again later.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as { error?: string; message?: string };

  if (!response.ok) {
    const error = payload.error ?? 'Invite failed';
    if (response.status === 502 || /sending.*email/i.test(error)) {
      throw new Error('Unable to send invitation email. Please try again in a moment.');
    }
    throw new Error(error);
  }

  return payload;
}
