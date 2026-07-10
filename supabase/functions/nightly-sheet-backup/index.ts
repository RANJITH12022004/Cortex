import { createServiceClient } from '../_shared/notify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BACKUP_TABLES = [
  'users',
  'vendors',
  'parts',
  'products',
  'purchase_requests',
  'serials',
  'damage_reports',
  'remarks',
  'stock_in_events',
] as const;

const TABLE_TIMESTAMP_COLUMN: Record<(typeof BACKUP_TABLES)[number], string> = {
  users: 'updated_at',
  vendors: 'updated_at',
  parts: 'updated_at',
  products: 'updated_at',
  purchase_requests: 'updated_at',
  serials: 'updated_at',
  damage_reports: 'reported_at',
  remarks: 'created_at',
  stock_in_events: 'received_at',
};

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function getGoogleAccessToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    throw new Error('Google service account not configured');
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const jwt = `${header}.${claim}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(tokenJson.error_description ?? 'Failed to get Google access token');
  }
  return tokenJson.access_token as string;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function flattenRow(row: Record<string, unknown>): string[] {
  return Object.values(row).map((value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: string[][],
) {
  if (rows.length === 0) return;

  const range = `${sheetName}!A:Z`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets append failed for ${sheetName}: ${err}`);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get('BACKUP_CRON_SECRET');
    const authHeader = req.headers.get('Authorization');
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
    if (!isCron) return jsonResponse({ error: 'Unauthorized' }, 401);

    const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_BACKUP_ID');
    if (!spreadsheetId) return jsonResponse({ error: 'GOOGLE_SHEETS_BACKUP_ID not set' }, 500);

    const adminClient = createServiceClient();
    const accessToken = await getGoogleAccessToken();
    const summary: Record<string, number> = {};

    for (const tableName of BACKUP_TABLES) {
      const { data: cursorRow } = await adminClient
        .from('sheet_backup_cursors')
        .select('last_synced_at')
        .eq('table_name', tableName)
        .maybeSingle();

      const lastSynced = cursorRow?.last_synced_at ?? '1970-01-01T00:00:00Z';

      const timestampColumn = TABLE_TIMESTAMP_COLUMN[tableName];

      const { data: rows, error } = await adminClient
        .from(tableName)
        .select('*')
        .not(timestampColumn, 'is', null)
        .gt(timestampColumn, lastSynced)
        .order(timestampColumn, { ascending: true })
        .limit(500);

      if (error) {
        console.error(`backup skip ${tableName}`, error.message);
        continue;
      }

      if (!rows || rows.length === 0) {
        summary[tableName] = 0;
        continue;
      }

      const payload = rows.map((row) => flattenRow(row as Record<string, unknown>));
      await appendRows(accessToken, spreadsheetId, tableName, payload);

      const newest = rows[rows.length - 1] as Record<string, string>;
      await adminClient.from('sheet_backup_cursors').upsert({
        table_name: tableName,
        last_synced_at: newest[timestampColumn],
      });

      summary[tableName] = rows.length;
    }

    return jsonResponse({ ok: true, appended: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
