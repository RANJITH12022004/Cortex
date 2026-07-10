import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendZohoEmail } from '../_shared/smtp.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['manager', 'senior_manager', 'employee', 'procurement']),
});

type UserRole = 'admin' | 'manager' | 'senior_manager' | 'procurement' | 'employee';

const ADMIN_INVITABLE_ROLES: UserRole[] = ['manager', 'senior_manager', 'procurement', 'employee'];
const MANAGER_INVITABLE_ROLES: UserRole[] = ['employee', 'procurement'];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function inviteEmailBody(actionLink: string): string {
  return [
    'You have been invited to Cortex OS.',
    '',
    'Accept your invitation and set your password using the link below:',
    actionLink,
    '',
    'If you did not expect this invitation, you can ignore this email.',
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !caller) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
    }

    const { email, role } = parsed.data;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile, error: profileError } = await adminClient
      .from('users')
      .select('id, role, active')
      .eq('id', caller.id)
      .single();

    if (profileError || !callerProfile?.active) {
      return jsonResponse({ error: 'Caller profile not found or inactive' }, 403);
    }

    const callerRole = callerProfile.role as UserRole;

    if (callerRole === 'admin' && !ADMIN_INVITABLE_ROLES.includes(role)) {
      return jsonResponse({ error: 'Admin cannot invite that role' }, 403);
    }

    if (callerRole === 'manager' || callerRole === 'senior_manager') {
      if (!MANAGER_INVITABLE_ROLES.includes(role)) {
        return jsonResponse({ error: 'Managers may only invite employees or procurement' }, 403);
      }
    }

    if (callerRole !== 'admin' && callerRole !== 'manager' && callerRole !== 'senior_manager') {
      return jsonResponse({ error: 'Insufficient permissions to invite users' }, 403);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: existingUser } = await adminClient
      .from('users')
      .select('id, email, role, active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return jsonResponse({
        message: 'User already exists',
        user: existingUser,
      });
    }

    const redirectTo = `${siteUrl}/auth/callback`;

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (linkError || !linkData?.user) {
      return jsonResponse({ error: linkError?.message ?? 'Invite failed' }, 400);
    }

    const actionLink = linkData.properties?.action_link;
    if (!actionLink) {
      return jsonResponse({ error: 'Unable to create invitation link.' }, 500);
    }

    try {
      await sendZohoEmail(
        normalizedEmail,
        "You've been invited to Cortex OS",
        inviteEmailBody(actionLink),
      );
    } catch (smtpError) {
      console.error('invite-user SMTP error', smtpError);
      await adminClient.auth.admin.deleteUser(linkData.user.id);
      return jsonResponse({ error: 'Unable to send invitation email. Please try again.' }, 502);
    }

    const { data: newProfile, error: insertError } = await adminClient
      .from('users')
      .insert({
        id: linkData.user.id,
        email: normalizedEmail,
        role,
        created_by: caller.id,
        active: true,
      })
      .select('id, email, role, active, created_at')
      .single();

    if (insertError) {
      console.error('invite-user profile insert failed', insertError.message);
      return jsonResponse({ error: insertError.message }, 400);
    }

    return jsonResponse({
      message: 'Invitation sent.',
      user: newProfile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('invite-user unhandled error', message);
    return jsonResponse({ error: message }, 500);
  }
});
