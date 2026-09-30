import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPECTED_HEADER = [
  'part_name',
  'description',
  'mpn',
  'footprint',
  'vendor_name',
  'unit_cost',
  'rack_code',
  'rack_name',
  'box_code',
  'box_name',
  'qty',
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }

  if (rows.length < 2) {
    throw new Error('CSV needs a header row and at least one data row');
  }

  const header = rows[0].map((value) => value.trim());
  for (const column of EXPECTED_HEADER) {
    if (!header.includes(column)) {
      throw new Error(`Missing column ${column}`);
    }
  }

  return rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    header.forEach((column, index) => {
      record[column] = (values[index] ?? '').trim();
    });
    return record;
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
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: profile, error: profileError } = await userClient
      .from('users')
      .select('role, active')
      .eq('id', user.id)
      .single();

    if (
      profileError ||
      !profile?.active ||
      !['super_admin', 'admin', 'inventory'].includes(profile.role)
    ) {
      return jsonResponse({ error: 'Not allowed to import inventory' }, 403);
    }

    const body = await req.json();
    const csv = typeof body?.csv === 'string' ? body.csv : '';
    if (!csv.trim()) {
      return jsonResponse({ error: 'CSV is empty' }, 400);
    }

    const rows = parseCsv(csv).map((row) => {
      const slim: Record<string, string> = {};
      for (const column of EXPECTED_HEADER) slim[column] = row[column] ?? '';
      return slim;
    });

    if (rows.length > 2000) {
      return jsonResponse({ error: 'Import at most 2000 rows at a time' }, 400);
    }

    const { data, error } = await userClient.rpc('import_inventory_rows', { p_rows: rows });
    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    const imported =
      data && typeof data === 'object' && 'imported' in data ? Number(data.imported) : rows.length;
    return jsonResponse({ imported });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 400);
  }
});
