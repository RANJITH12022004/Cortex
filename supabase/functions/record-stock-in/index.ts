import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { checkLowStockAndNotify } from '../_shared/notify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const payloadSchema = z.object({
  requestId: z.string().min(1),
  partId: z.string().uuid(),
  vendorId: z.string().uuid().nullable().optional(),
  qty: z.number().positive(),
  unitCost: z.number().min(0),
  notes: z.string().trim().nullable().optional(),
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);
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

    if (
      profileError ||
      !callerProfile?.active ||
      !['procurement', 'admin', 'manager', 'senior_manager'].includes(callerProfile.role)
    ) {
      return jsonResponse({ error: 'Not allowed to record stock in' }, 403);
    }

    const { data, error } = await adminClient.rpc('record_stock_in_event', {
      p_request_id: parsed.data.requestId,
      p_part_id: parsed.data.partId,
      p_vendor_id: parsed.data.vendorId ?? null,
      p_qty: parsed.data.qty,
      p_unit_cost: parsed.data.unitCost,
      p_notes: parsed.data.notes ?? null,
      p_received_by: user.id,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    await checkLowStockAndNotify(adminClient, parsed.data.partId);

    return jsonResponse({ event: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
