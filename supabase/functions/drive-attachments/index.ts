import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const payloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('upload'),
    serial_id: z.string().uuid(),
    step_name: z.string().min(1),
    task_type: z.enum(['assembly', 'qc', 'packing', 'delivery', 'installation']).nullable().optional(),
    checkpoint_name: z.string().nullable().optional(),
    file_name: z.string().min(1),
    file_type: z.string().min(1),
    content_base64: z.string().min(1),
  }),
  z.object({
    action: z.literal('delete'),
    attachment_id: z.string().uuid(),
  }),
]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toBase64Url(input: string | Uint8Array) {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function getGoogleAccessToken(serviceAccountEmail: string, privateKey: string) {
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = toBase64Url(
    JSON.stringify({
      iss: serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );
  const unsignedToken = `${header}.${claimSet}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(privateKey.replace(/-----[^-]+-----|\n/g, '')), (char) => char.charCodeAt(0)),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${toBase64Url(new Uint8Array(signature))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!tokenRes.ok) throw new Error('Failed to obtain Google access token');
  const tokenBody = await tokenRes.json();
  return tokenBody.access_token as string;
}

async function uploadToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileType: string,
  contentBase64: string,
) {
  const boundary = `facman-${crypto.randomUUID()}`;
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const fileBytes = Uint8Array.from(atob(contentBase64), (char) => char.charCodeAt(0));
  const body = new Uint8Array(
    new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${fileType}\r\n\r\n`,
    ).length +
      fileBytes.length +
      new TextEncoder().encode(`\r\n--${boundary}--`).length,
  );

  let offset = 0;
  const prefix = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${fileType}\r\n\r\n`,
  );
  body.set(prefix, offset);
  offset += prefix.length;
  body.set(fileBytes, offset);
  offset += fileBytes.length;
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--`);
  body.set(suffix, offset);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) throw new Error('Google Drive upload failed');
  return await res.json();
}

async function deleteFromDrive(accessToken: string, fileId: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) throw new Error('Google Drive delete failed');
}

function extractDriveFileId(link: string) {
  const match = link.match(/\/d\/([^/]+)\//);
  return match?.[1] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    const folderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID');

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !serviceAccountEmail || !privateKey || !folderId) {
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

    if (profileError || !callerProfile?.active) {
      return jsonResponse({ error: 'Caller profile not found or inactive' }, 403);
    }

    const accessToken = await getGoogleAccessToken(serviceAccountEmail, privateKey);

    if (parsed.data.action === 'upload') {
      const driveFile = await uploadToDrive(
        accessToken,
        folderId,
        parsed.data.file_name,
        parsed.data.file_type,
        parsed.data.content_base64,
      );

      const { data, error } = await adminClient
        .from('attachments')
        .insert({
          serial_id: parsed.data.serial_id,
          step_name: parsed.data.step_name,
          task_type: parsed.data.task_type ?? null,
          checkpoint_name: parsed.data.checkpoint_name ?? null,
          drive_link: driveFile.webViewLink,
          file_type: parsed.data.file_type,
          uploaded_by: user.id,
        })
        .select('*')
        .single();

      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ attachment: data });
    }

    if (callerProfile.role !== 'admin') {
      return jsonResponse({ error: 'Only admins can delete attachments' }, 403);
    }

    const { data: attachment, error: attachmentError } = await adminClient
      .from('attachments')
      .select('*')
      .eq('id', parsed.data.attachment_id)
      .single();

    if (attachmentError || !attachment) {
      return jsonResponse({ error: 'Attachment not found' }, 404);
    }

    const fileId = extractDriveFileId(attachment.drive_link);
    if (fileId) await deleteFromDrive(accessToken, fileId);

    const { error } = await adminClient.from('attachments').delete().eq('id', parsed.data.attachment_id);
    if (error) return jsonResponse({ error: error.message }, 400);

    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
