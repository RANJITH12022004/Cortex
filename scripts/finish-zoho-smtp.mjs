#!/usr/bin/env node
/**
 * Sync Zoho SMTP Edge Function secrets and send a test notification email.
 * Uses the same mailbox/password as Supabase Auth → SMTP (smtp.zoho.in).
 *
 * Usage (PowerShell) — run from the FacMan repo root:
 *   cd C:\Users\ranjith\Downloads\FacMan
 *   $env:ZOHO_SMTP_PASS = 'your-zoho-app-password'
 *   npm run finish:zoho-smtp
 */
import { execSync } from 'node:child_process';

const projectRef = 'ttgquwvfpknqlfrnfksk';
const password = process.env.ZOHO_SMTP_PASS ?? process.env.ZOHO_SMTP_PASSWORD;

if (!password) {
  console.error('Set ZOHO_SMTP_PASS to your Zoho application-specific password first.');
  process.exit(1);
}

const secrets = {
  ZOHO_SMTP_HOST: 'smtp.zoho.in',
  ZOHO_SMTP_PORT: '465',
  ZOHO_SMTP_USER: 'task@raiselabequip.com',
  ZOHO_FROM_EMAIL: 'task@raiselabequip.com',
  ZOHO_SMTP_PASS: password,
  NOTIFY_INVOKE_SECRET: 'facman-notify-1ed5f422710441fca5f112940e859f58',
};

const setArgs = Object.entries(secrets)
  .map(([key, value]) => `${key}=${value}`)
  .join(' ');

execSync(`npx supabase secrets set ${setArgs} --project-ref ${projectRef}`, {
  stdio: 'inherit',
  shell: true,
});

execSync(
  `npx supabase functions deploy invite-user send-notification-email workflow-notify --project-ref ${projectRef}`,
  { stdio: 'inherit', shell: true },
);

const body = JSON.stringify({
  to: 'ranjith@raiselabequip.com',
  subject: 'FacMan test notification',
  body: 'If you received this, Zoho SMTP and send-notification-email are working.',
  event_type: 'task_assigned',
});

const response = await fetch(
  `https://${projectRef}.supabase.co/functions/v1/send-notification-email`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secrets.NOTIFY_INVOKE_SECRET}`,
      'Content-Type': 'application/json',
    },
    body,
  },
);

const result = await response.json();
console.log(response.status, JSON.stringify(result, null, 2));
process.exit(response.ok ? 0 : 1);
