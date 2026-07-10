import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { notifyTaskAssignment } from '../_shared/assignment-notify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const payloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('assign_purchase_request'),
    requestId: z.string().uuid(),
    assignedTo: z.string().uuid(),
  }),
  z.object({
    action: z.literal('assign_serial_stage'),
    serialId: z.string().uuid(),
    taskType: z.enum(['assembly', 'qc', 'packing', 'delivery', 'installation']),
    assignedTo: z.string().uuid(),
  }),
  z.object({
    action: z.literal('complete_assignment'),
    serialId: z.string().uuid(),
    taskType: z.enum(['assembly', 'qc', 'packing', 'delivery', 'installation']),
    actorId: z.string().uuid(),
    nextStage: z.string().min(1),
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile, error: profileError } = await adminClient
      .from('users')
      .select('id, role, active')
      .eq('id', user.id)
      .single();

    if (profileError || !callerProfile?.active || callerProfile.role !== 'manager') {
      return jsonResponse({ error: 'Only managers can assign workflow tasks' }, 403);
    }

    if (parsed.data.action === 'assign_purchase_request') {
      const { data, error } = await adminClient.rpc('assign_purchase_request', {
        p_request_id: parsed.data.requestId,
        p_assigned_to: parsed.data.assignedTo,
        p_assigned_by: user.id,
      });

      if (error) return jsonResponse({ error: error.message }, 400);

      const serials = (data ?? []) as Array<{ id: string; serial_number: string }>;
      const { data: prRow } = await adminClient
        .from('purchase_requests')
        .select('products(name)')
        .eq('id', parsed.data.requestId)
        .single();
      const productName = (prRow?.products as { name?: string } | null)?.name;

      for (const serial of serials) {
        await notifyTaskAssignment({
          assignedTo: parsed.data.assignedTo,
          serialNumber: serial.serial_number,
          taskType: 'assembly',
          productName,
        });
      }

      return jsonResponse({ serials });
    }

    if (parsed.data.action === 'complete_assignment') {
      const { data, error } = await adminClient.rpc('complete_serial_assignment', {
        p_serial_id: parsed.data.serialId,
        p_task_type: parsed.data.taskType,
        p_actor: parsed.data.actorId,
        p_next_stage: parsed.data.nextStage,
      });

      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ serial: data });
    }

    const { data, error } = await adminClient.rpc('assign_serial_stage', {
      p_serial_id: parsed.data.serialId,
      p_task_type: parsed.data.taskType,
      p_assigned_to: parsed.data.assignedTo,
      p_assigned_by: user.id,
    });

    if (error) return jsonResponse({ error: error.message }, 400);

    const assignment = data as { assigned_to: string };
    const { data: serialRow } = await adminClient
      .from('serials')
      .select('serial_number, purchase_requests(products(name))')
      .eq('id', parsed.data.serialId)
      .single();
    const productName =
      (serialRow?.purchase_requests as { products?: { name?: string } } | null)?.products?.name;

    await notifyTaskAssignment({
      assignedTo: assignment.assigned_to,
      serialNumber: serialRow?.serial_number ?? parsed.data.serialId,
      taskType: parsed.data.taskType,
      productName,
    });

    return jsonResponse({ assignment: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
