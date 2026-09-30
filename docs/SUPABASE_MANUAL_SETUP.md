# Supabase Manual Setup Checklist

Complete these steps in the Supabase Dashboard (and CLI where noted) after cloning the repo. The app cannot authenticate or invite users until this is done.

## 1. Create project and env vars

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → API**.
3. Copy **Project URL** and **anon public** key into `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Never put the **service role** key in `.env.local` or any client-shipped file.

## 2. Apply database migrations

**Option A — Supabase CLI (recommended)**

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

**Option B — SQL Editor**

Run each file in order from `supabase/migrations/`:

1. `20250702000001_initial_schema.sql`
2. `20250702000002_seed_admin.sql` (comments only — no statements to run)
3. `20250702000003_rls_helpers.sql`
4. `20250702000004_rls_policies.sql`
5. `20250702000005_products_archived.sql`
6. `20250702000006_procurement_flows.sql`
7. `20250702000007_task_workflow.sql`
8. `20250702000008_notifications_polish.sql`
9. `20250702000009_backup_updated_at.sql`
10. `20250702000010_senior_manager_role.sql`
11. `20250702000011_senior_manager_rls_helpers.sql`
12. `20250702000012_notification_email_triggers.sql`

## 3. Disable public signup

**Authentication → Providers → Email**

- Ensure email provider is enabled (for invite + sign-in).
- **Disable** “Enable sign ups” / public registration.

Also confirm in `supabase/config.toml` (for local dev):

```toml
[auth]
enable_signup = false

[auth.email]
enable_signup = false
```

Cloud project: the dashboard setting is authoritative.

## 4. Configure Auth URLs

**Authentication → URL Configuration**

| Setting | Development | Production |
|---|---|---|
| Site URL | `http://localhost:5173` | `https://YOUR_VERCEL_DOMAIN` |
| Redirect URLs | `http://localhost:5173/auth/callback` | `https://YOUR_VERCEL_DOMAIN/auth/callback` |

Invite emails redirect to `/auth/callback` so the user can set their password.

## 5. Configure custom SMTP (Zoho)

**Authentication → SMTP Settings → Enable custom SMTP**

Use your client's Zoho mailbox (not Supabase's default mailer):

| Field | Typical Zoho value |
|---|---|
| Host | `smtp.zoho.in` (India) or `smtp.zoho.com` |
| Port | `465` (SSL) or `587` (TLS) |
| Username | Full mailbox address |
| Password | App-specific password |
| Sender email | Same mailbox |
| Sender name | e.g. `Cortex` |

Send a test email from the dashboard to confirm delivery before inviting users.

## 6. Email templates (optional)

**Authentication → Email Templates**

Customize the **Invite user** template if desired. Default works for v1.

## 7. Seed the first admin

The admin is created manually (one-time):

1. **Authentication → Users → Add user**
   - Email + temporary password (or send invite — then run SQL below after user exists)
2. Copy the user's **UUID** from the users list.
3. In **SQL Editor**, run (replace placeholders):

```sql
INSERT INTO public.users (id, email, role, created_by, active)
VALUES (
  'PASTE_AUTH_USER_UUID_HERE',
  'admin@yourcompany.com',
  'admin',
  NULL,
  TRUE
);
```

Sign in as this admin at `/login`, then use **Invite manager** at `/admin/invite`.

## 8. Deploy Edge Functions

```bash
supabase functions deploy invite-user
supabase functions deploy record-stock-in
supabase functions deploy issue-serial-materials
supabase functions deploy issue-damage-replacement
supabase functions deploy manage-assignments
supabase functions deploy drive-attachments
supabase functions deploy register-push
supabase functions deploy workflow-notify
supabase functions deploy send-notification-email
supabase functions deploy nightly-sheet-backup
```

Set the site URL secret so invite redirects work in production:

```bash
supabase secrets set SITE_URL=https://YOUR_VERCEL_DOMAIN
```

For local function testing:

```bash
supabase secrets set SITE_URL=http://localhost:5173
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in hosted Edge Functions.

Set the Google Drive attachment secrets before deploying `drive-attachments`:

```bash
supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
supabase secrets set GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
supabase secrets set GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id
```

Set notification and backup secrets:

```bash
supabase secrets set ZOHO_SMTP_HOST=smtp.zoho.in
supabase secrets set ZOHO_SMTP_PORT=465
supabase secrets set ZOHO_SMTP_USER=your-mailbox@yourcompany.com
supabase secrets set ZOHO_SMTP_PASSWORD=your-app-password
supabase secrets set ZOHO_FROM_EMAIL=your-mailbox@yourcompany.com
supabase secrets set VAPID_PUBLIC_KEY=your-vapid-public-key
supabase secrets set VAPID_PRIVATE_KEY=your-vapid-private-key
supabase secrets set VAPID_SUBJECT=mailto:your-mailbox@yourcompany.com
supabase secrets set GOOGLE_SHEETS_BACKUP_ID=your_google_sheet_id
supabase secrets set BACKUP_CRON_SECRET=long-random-cron-secret
supabase secrets set NOTIFY_INVOKE_SECRET=long-random-notify-secret
```

`ZOHO_SMTP_PASS` is the preferred secret name for the Zoho mailbox password (`send-notification-email` also accepts legacy `ZOHO_SMTP_PASSWORD`).

**Important:** Authentication → SMTP and Edge Function secrets are separate. After saving custom SMTP in the dashboard, also run:

```bash
supabase secrets set ZOHO_SMTP_PASS=your-zoho-app-password
```

Use the same Zoho **application-specific password** and mailbox as Auth SMTP (`smtp.zoho.in`, port `465`).

After setting `NOTIFY_INVOKE_SECRET`, store the same value in Supabase Vault so database triggers can call the Edge Function (SQL Editor):

```sql
SELECT vault.create_secret(
  'long-random-notify-secret',
  'notify_invoke_secret',
  'Shared secret for DB triggers -> send-notification-email'
);
```

Optional: override the functions base URL used by triggers (defaults to your linked project URL):

```sql
ALTER DATABASE postgres SET app.facman_supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
```

Generate VAPID keys (one-time, locally):

```bash
npx web-push generate-vapid-keys
```

Copy the **public** key to `.env.local` as `VITE_VAPID_PUBLIC_KEY` and both keys to Supabase secrets above.

### Nightly Google Sheet backup (cron)

1. Create a Google Sheet with tabs named exactly: `users`, `vendors`, `parts`, `products`, `purchase_requests`, `serials`, `damage_reports`, `remarks`, `stock_in_events`.
2. Share the sheet with your service account email (Editor).
3. In Supabase **Database → Extensions**, enable `pg_cron` and `pg_net` if available, or use an external cron (e.g. GitHub Actions) to `POST` nightly:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/nightly-sheet-backup" \
  -H "Authorization: Bearer YOUR_BACKUP_CRON_SECRET"
```

The job is **append-only** — it never deletes Supabase data.
It relies on the latest migrations so mutable tables can back up by their `updated_at` cursor instead of only first-create time.

## 9. Regenerate TypeScript types

After migrations are applied:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

Replace the placeholder types file so the client matches the live schema.

## 10. Verify RLS

In **Table Editor**, confirm **RLS enabled** on every table:

- `users`, `vendors`, `parts`, `products`, `bom`
- `assembly_templates`, `qc_templates`, `purchase_requests`
- `serials`, `serial_steps`, `qc_results`, `attachments`
- `material_handover`, `damage_reports`, `remarks`
- `delivery_install`, `notifications_log`

`remarks` should have **SELECT + INSERT** policies only (no UPDATE/DELETE).

## 11. Vercel deployment (frontend)

1. Connect the repo to Vercel.
2. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Add the Vercel production URL to Supabase redirect URLs (step 4).
4. Redeploy after env vars are set.

## Smoke test checklist

- [ ] Admin can sign in and lands on `/admin`
- [ ] Admin can invite a manager (email received via Zoho)
- [ ] Manager completes invite at `/auth/callback`, sets password, lands on `/dashboard`
- [ ] Manager can invite employee/procurement at `/team/invite`
- [ ] Each role is blocked from other roles' routes (redirected to own home)
- [ ] `npm run build` succeeds with PWA manifest in `dist/`

## Troubleshooting

| Issue | Fix |
|---|---|
| Invite email not received | Check Zoho SMTP credentials; spam folder; Supabase Auth logs |
| "Profile not found" after login | `users` row missing — run seed SQL for that auth user |
| Invite redirect fails | Add exact callback URL to Supabase redirect allow list |
| Edge Function 403 | Caller must have `admin` or `manager` role in `users` table |
| CORS errors on invite | Function includes CORS headers; ensure calling with valid JWT |
