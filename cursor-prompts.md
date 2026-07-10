# Cursor Build Sequence — 5 Prompts

Run these in order, in Cursor's Plan mode, with `PRD.md` and `.cursorrules` already in the
repo root before Prompt 1. Let Cursor finish + you verify/test each prompt's output before
moving to the next — don't chain them blind. Each prompt assumes everything from the
prior prompts already exists in the repo.

---

## Prompt 1 — Foundation: schema, auth, PWA shell

```
Read PRD.md and .cursorrules fully before starting.

Set up the project foundation:
1. Scaffold a React + Vite + TypeScript app configured as an installable PWA
   (manifest.json, service worker, icons placeholder).
2. Write the full Supabase schema from PRD.md section 4 as SQL migrations
   (users, vendors, parts, products, bom, assembly_templates, qc_templates,
   purchase_requests, serials, serial_steps, qc_results, attachments,
   material_handover, damage_reports, remarks, delivery_install,
   notifications_log).
3. Enable RLS on every table with default-deny, then add explicit policies
   for admin/manager/procurement/employee per PRD section 3.
4. Implement the invite-only auth flow: disable public signup, build the
   admin-creates-manager / manager-creates-employee invite flow using
   inviteUserByEmail, and document the custom SMTP (Zoho) config steps
   needed in the Supabase dashboard (I'll do that part manually).
5. Build session persistence using Supabase access/refresh tokens only —
   no password storage on device, per .cursorrules.
6. Set up role-based route guards (admin/manager/procurement/employee land
   on different default routes).

Stop after this and give me a summary of what's left to configure manually
in the Supabase dashboard (SMTP credentials, redirect URLs, etc.).
```

---

## Prompt 2 — Product setup: BOM, templates, vendors

```
Build the Manager-facing product setup module per PRD.md section 5.2:
1. Product CRUD (create/edit/archive a product).
2. BOM builder UI: attach parts + required quantities to a product.
3. Assembly checklist template builder: manager defines an ordered list of
   steps per product (e.g. Materials Collected, Mechanical Assembly, Wiring,
   Electronics Assembly) — steps are custom per product, not hardcoded.
4. QC checklist template builder: manager defines ordered pass/fail
   checkpoints per product.
5. Parts + vendor management: CRUD for parts (name, description, mpn,
   vendor, unit_cost, qty_available, storage_location) and vendors
   (name, contact info).

All of this is manager-only — enforce via the route guards and RLS policies
from Prompt 1. Use the generated Supabase types, don't hand-write duplicate
interfaces.
```

---

## Prompt 3 — Order intake and procurement

```
Build order intake and procurement per PRD.md sections 5.3 and 5.5:
1. Manager creates a PR (product + quantity + priority). On save, run the
   BOM availability check against parts.qty_available automatically and
   set status to "ready" or "procurement_hold" with the exact shortfall
   shown if short.
2. Procurement stock-in form: log part + quantity + vendor + cost,
   updates qty_available.
3. One-click stock-out: once a serial is assigned (built in Prompt 4, stub
   the trigger point for now), procurement sees the full BOM parts list
   for that serial and issues everything in a single action, creating
   material_handover rows and decrementing qty_available.
4. Two-sided handover confirmation: employee-side confirmation UI for
   receiving issued materials.
5. Damage/faulty part reporting flow: employee reports a part as damaged
   from their task screen, procurement gets notified, issues a replacement,
   linked back to the original handover as damage_reports + a new
   material_handover row.

Follow the idempotency and audit-field rules in .cursorrules (issued_by,
received_by, reported_by on every relevant row).
```

---

## Prompt 4 — Task assignment, production workflow, QC

```
Build the task and production workflow per PRD.md sections 5.4, 5.6, 5.7,
5.9:
1. Manager dashboard: live view of every employee's current status
   (idle/on task) and the full task queue ordered by priority. Manager
   manually assigns a "ready" PR to a specific employee — never auto-assign.
   On assignment, create one serials row per unit in the PR quantity.
2. Employee task view: shows the assigned serial's assembly checklist
   (from the product's assembly_templates), lets the employee tap each
   step as reached, writing timestamped rows to serial_steps that update
   the manager dashboard live (use Supabase Realtime).
3. QC form: shown per-product from qc_templates, each checkpoint is a
   pass/fail radio with optional note + photo/doc attachment. Overall
   fail routes the serial back to a rework/production state automatically
   per .cursorrules — never let it silently proceed to packing.
4. File attachment upload: build the Edge Function that receives a file
   from the client, uploads it to the designated Google Drive folder via
   a service account, and stores the returned link in the attachments
   table linked to serial_id + step. Compress images client-side before
   upload. Enforce that only admin role can edit/delete an attachment.
5. Packing, delivery, and installation steps: simple forms per PRD 5.8
   (packed confirmation, delivery partner + docs link, installer + docs
   link), each with an append-only remarks field.
```

---

## Prompt 5 — Notifications, analytics, and polish

```
Finish the system per PRD.md sections 5.10, 5.11, 5.12, 5.13:
1. Notification triggers: on task assignment, step completion, QC fail,
   low stock, and damage report — send an email via the Zoho SMTP Edge
   Function to the relevant user, and a Web Push notification for
   real-time in-app awareness.
2. Manager analytics: per-employee task counts, average completion time
   (from serial_steps start/done timestamps), QC pass rate — as a simple
   dashboard view.
3. Vendor cost/damage report: aggregate damage_reports by vendor and part,
   showing total units wasted and total ₹ wasted over a selectable date
   range.
4. Serial number traceability lookup: given a serial number, render its
   full history on one screen (assigned_to, every assembly step + time,
   every QC result + docs, packed_by, delivery, installation, all remarks).
5. Nightly backup job: a scheduled Edge Function that appends new/changed
   rows to a Google Sheet as an audit safety net — additive only, never
   deletes anything from Supabase.
6. PWA polish: proper icons, offline fallback page, install prompt.

After this, do a full pass checking every rule in .cursorrules is actually
followed (no exposed service role key, RLS on every table, no password
storage, append-only remarks) and report anything that slipped through.
```
