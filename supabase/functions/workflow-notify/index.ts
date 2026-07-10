import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  createServiceClient,
  notifyRoleUsers,
} from '../_shared/notify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const payloadSchema = z.discriminatedUnion('eventType', [
  z.object({
    eventType: z.literal('step_completed'),
    serialId: z.string().uuid(),
    stepName: z.string().min(1),
  }),
  z.object({
    eventType: z.literal('qc_failed'),
    serialId: z.string().uuid(),
  }),
  z.object({
    eventType: z.literal('damage_reported'),
    damageReportId: z.string().uuid(),
  }),
]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const parsed = payloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
    }

    const adminClient = createServiceClient();

    if (parsed.data.eventType === 'step_completed') {
      const { data: serial } = await adminClient
        .from('serials')
        .select('serial_number')
        .eq('id', parsed.data.serialId)
        .single();

      const subject = `Step completed: ${parsed.data.stepName}`;
      const body = `Serial ${serial?.serial_number ?? parsed.data.serialId} — ${parsed.data.stepName} marked complete.`;

      await notifyRoleUsers(adminClient, 'manager', {
        eventType: 'step_completed',
        subject,
        body,
        url: '/dashboard',
      });
    }

    if (parsed.data.eventType === 'qc_failed') {
      const { data: serial } = await adminClient
        .from('serials')
        .select('serial_number')
        .eq('id', parsed.data.serialId)
        .single();

      const subject = `QC failed: ${serial?.serial_number ?? 'unit'}`;
      const body = `Serial ${serial?.serial_number ?? parsed.data.serialId} failed QC and was routed to rework.`;

      await notifyRoleUsers(adminClient, 'manager', {
        eventType: 'qc_failed',
        subject,
        body,
        url: '/dashboard',
      });
    }

    if (parsed.data.eventType === 'damage_reported') {
      const { data: report } = await adminClient
        .from('damage_reports')
        .select('reason, serials(serial_number), parts(name)')
        .eq('id', parsed.data.damageReportId)
        .single();

      const serialNumber =
        (report?.serials as { serial_number?: string } | null)?.serial_number ?? 'unit';
      const partName = (report?.parts as { name?: string } | null)?.name ?? 'part';
      const subject = `Damage reported: ${partName}`;
      const body = `${partName} on serial ${serialNumber}: ${report?.reason ?? 'damage reported'}.`;

      await notifyRoleUsers(adminClient, 'procurement', {
        eventType: 'damage_reported',
        subject,
        body,
        url: '/procurement',
      });
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
