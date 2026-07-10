# PRD — Production & Warehouse Management System

**Client:** [Client Name] — small manufacturing shop, ~20 employees
**Volume:** 40–80 PRs/month, one PR in flight at a time
**Prepared by:** Ranjith Kumar Dasari
**Status:** v1 — freelance build

---

## 1. Problem Statement

The client currently tracks orders, parts availability, production status, quality checks, and delivery/installation manually (paper/memory). There is no single source of truth for what's in stock, who's building what, or the full history of a finished unit. This system replaces that with a single web app (installable on desktop, Android, and iOS as a PWA) covering order intake → BOM check → task assignment → production → QC → packing → delivery → installation, plus warehouse in/out and vendor cost tracking.

## 2. Goals

- Manager always knows, at a glance, who is doing what and what's next in the queue — without walking the floor.
- Every unit built has a full, permanent, timestamped record of who touched it at every step.
- Procurement can issue all materials for an order in one click instead of manual counting.
- Business gets automatic visibility into material waste and vendor reliability, in ₹, over time.
- Zero data loss, zero password-security shortcuts, zero infra the client can't afford or maintain.

## 3. Users & Roles

| Role | Created by | Responsibilities |
|---|---|---|
| **Admin** | (seeded manually, one-time) | Creates the Manager account. Otherwise stays out of daily operation. |
| **Manager** | Admin | Creates employee accounts. Creates products (BOM + assembly checklist template + QC checklist template). Views dashboard. Assigns ready tasks to free employees. Sets task priority. Does not do data entry. |
| **Procurement** | Manager | Logs stock in. Releases (issues) all BOM materials for an assigned order in one click. Confirms handover. Issues replacements for damaged/faulty parts. Views vendor/cost reports. |
| **Employee** | Manager | Executes tasks assigned to them. A single employee account can be assigned assembly, QC, packing, delivery, or installation tasks — **role does not hardcode task type; the task itself carries a `task_type` that determines which form/checklist is shown.** (Confirm with client whether QC must always be a *different* person than the assembler — if yes, add a `cannot_self_assign_qc` constraint at assignment time.) |

**Open question for client:** Should the same employee ever assemble AND QC the same unit? Default assumption in this PRD: **no** — QC must be a different employee than the assembler, enforced at assignment time. Flag if this is wrong.

## 4. Core Entities (Data Model)

```
users            (id, email, role, created_by, active, created_at)
vendors          (id, name, contact_info, created_at)
parts            (id, name, description, mpn, footprint, vendor_id, unit_cost,
                   qty_available, storage_location, last_used_at)
products         (id, name, description, created_by, created_at)
bom              (id, product_id, part_id, qty_required)

assembly_templates  (id, product_id, step_order, step_name)      -- e.g. Materials Collected,
                                                                     Mechanical Assembly, Wiring,
                                                                     Electronics Assembly
qc_templates        (id, product_id, checkpoint_order, checkpoint_name)

purchase_requests (pr)  (id, product_id, qty, priority, status, created_by, created_at)
                          status: pending_check | ready | procurement_hold | assigned |
                                  in_progress | qc | packing | delivery | installed | done

serials          (id, pr_id, serial_number, assigned_to, assigned_by, priority,
                   current_stage, created_at)

serial_steps      (id, serial_id, step_name, status, done_by, started_at, completed_at)
                    -- one row per assembly_template step, live-updated

qc_results        (id, serial_id, checkpoint_name, result [pass/fail], note,
                    checked_by, checked_at)

attachments       (id, serial_id, step_name, drive_link, file_type,
                    uploaded_by, uploaded_at)

material_handover (id, serial_id, part_id, qty, issued_by, issued_at,
                    received_by, received_at)               -- two-sided confirmation

damage_reports    (id, serial_id, part_id, reason, reported_by, reported_at,
                    replacement_issued_by, replacement_issued_at)

remarks           (id, serial_id, step_name, author, text, created_at)  -- append-only

delivery_install  (id, serial_id, delivery_partner, delivery_docs_link,
                    installed_by, installation_docs_link, installed_at)

notifications_log (id, user_id, event_type, channel [email/push], sent_at)
```

Notes:
- `parts.qty_available` is the running stock number; every `material_handover` and stock-in event adjusts it.
- `serials` is the traceability spine — one row per physical unit, everything else hangs off `serial_id`.
- No table is ever purged. Free-tier storage math (see §7) supports indefinite retention at this client's volume.

## 5. Functional Requirements

### 5.1 Auth & Accounts
- Invite-only. Public signup disabled in Supabase Auth.
- Admin creates Manager → Manager creates Employees/Procurement, via `inviteUserByEmail`.
- Invite + all auth emails routed through the client's Zoho SMTP (custom SMTP config in Supabase), not Supabase's default mailer.
- Invited user sets their own password on first login via the emailed link.
- Session persists via Supabase access/refresh tokens — **password is never stored on device.** Optional PIN/biometric unlock layered on top of the persisted session for fast re-entry.
- RBAC enforced via Postgres Row Level Security — every table default-denies, explicit per-role policies grant access.

### 5.2 Product Setup (Manager)
- Create product → define BOM (parts + quantities) → define assembly checklist template (ordered steps) → define QC checklist template (ordered pass/fail checkpoints). All three saved together, reused on every future order of that product.

### 5.3 Order Intake & Availability Check
- Manager creates a PR: product + quantity + priority.
- System checks `parts.qty_available` against the BOM automatically.
- All available → PR status `ready`, appears on manager dashboard for assignment, procurement notified materials will be needed.
- Any part short → PR status `procurement_hold`, procurement notified with exact shortfall.

### 5.4 Task Assignment (Manager-driven, never automatic)
- Manager dashboard shows: every employee's current status (idle/on task), the full queue ordered by priority.
- Manager manually assigns a `ready` PR to a specific free employee. System never auto-assigns.
- On assignment, a `serials` row is created (one per unit in the PR quantity) and procurement is notified to prepare handover.

### 5.5 Procurement — Stock In / Out
- **Stock in:** procurement logs part, quantity, vendor, cost, timestamp. Updates `parts.qty_available`.
- **Stock out (one-click issue):** once a serial is assigned, procurement sees the full BOM parts list for that serial and issues everything in one action → creates `material_handover` rows, decrements `qty_available`.
- **Handover confirmation:** employee confirms receipt in-app (two-sided record — protects both parties).
- **Damage/faulty part mid-assembly:** employee reports from their task screen (part, reason) → `damage_reports` row created → procurement notified → issues replacement → linked handover → employee resumes task. No separate paperwork.

### 5.6 Production Workflow
- Employee opens assigned task, sees the product's assembly checklist (from template).
- Taps each step as reached (e.g. Materials Collected → Mechanical Assembly → Wiring → Electronics Assembly) — writes to `serial_steps` with timestamps, live-visible on manager dashboard.
- No manager polling/asking required — visibility is a byproduct of the employee doing their normal job.

### 5.7 QC
- QC checklist shown per-product (from `qc_templates`), each checkpoint is Pass/Fail (radio), with optional note + photo/doc attachment per item.
- Overall unit result: Pass → moves to packing. Fail → routed back to production/rework automatically, does not proceed.
- All QC results permanently stored against the serial number.

### 5.8 Packing, Delivery, Installation
- Packing: employee marks packed, optional photo.
- Delivery: delivery partner name + docs link recorded.
- Installation: installer name + installation docs recorded.
- Each of the above supports a remarks field (append-only log, never overwritten).

### 5.9 File Attachments (Drive Integration)
- Employees upload photos/PDFs directly from the app — never touch Google Drive UI, never paste a link.
- App backend (Edge Function) uploads to a single client-owned Drive folder using a **service account**, returns the file link, stores it in `attachments` linked to the serial + step.
- Permissions enforced in-app, not via Drive sharing: any employee can upload/view via the app; only Admin can edit/delete an attachment (calls Drive API through the same service account, gated by RLS role check).
- Client-side image compression before upload to conserve Drive quota.

### 5.10 Notifications
- Every event (task assigned, step completed, QC failed, stock low, damage reported) sends an email via Zoho SMTP to the relevant user.
- Push notifications (Web Push, works on installed PWA incl. iOS 16.4+) fire for real-time in-app awareness; email is the reliable fallback channel for everything.

### 5.11 Manager Dashboard
- Live view: every employee + current task/status, full priority-ordered queue, per-order stage.
- Appraisal data: per-employee task counts, average completion time (start→done timestamps), QC pass rate — computed from existing data, no extra logging needed.

### 5.12 Vendor Cost & Damage Analytics
- Every part has `vendor_id` + `unit_cost`. Every `damage_reports` row rolls up into a report: total units wasted, total ₹ wasted, grouped by vendor/part, over any selected time range. Purpose: surface which vendor's parts are causing the most rework/waste, backed by numbers.

### 5.13 Traceability Lookup
- Given a serial number, show full history: assigned_to, every assembly step + timestamp, every QC result + docs, packed_by, delivery partner + docs, installed_by + docs, all remarks — single screen.

## 6. Non-Functional Requirements

- **Hosting:** Vercel (frontend, free tier) + Supabase (Postgres/Auth/Edge Functions, free tier). No FastAPI service, no Raspberry Pi, no separate backend host.
- **Platform:** Single React PWA codebase — installable on Android, iOS (16.4+), and usable as a normal tab on desktop. No native Java/Kotlin/Swift builds for v1.
- **Data retention:** No purge/FIFO deletion job. At 40–80 PRs/month the DB grows ~1–1.5MB/month — free tier lasts 10+ years even at 3x this volume. A daily incremental append-only backup job mirrors new/changed rows to a Google Sheet as an audit safety net (does not replace Supabase as source of truth).
- **Security:** No password ever stored client-side — session tokens only. Service role key never shipped to client bundle — all privileged operations (Drive upload, invite, stock adjustments needing elevated trust) run server-side in Edge Functions. RLS enabled on every table, default deny.
- **Offline:** Out of scope for v1 (flag as future phase — factory wifi may be unreliable; revisit if it becomes a real blocker).

## 7. Out of Scope for v1 (Future Phases)

- Native app store apps (only if PWA proves insufficient)
- Offline-first sync
- Multi-warehouse / multi-location inventory
- Delivery partner API integrations (currently just a text field + doc link)
- BOM versioning / mid-production BOM changes
- Multiple concurrent PRs / stock reservation locking (not needed at one-PR-at-a-time volume; revisit if client's ordering model changes)

## 8. Build Phasing (for client billing/milestones)

1. **Phase 1 — Core:** Auth/RBAC, product+BOM, PR intake + availability check, procurement in/out, basic task assign/start/done.
2. **Phase 2 — Workflow depth:** Assembly/QC checklist templates, substep live tracking, QC pass/fail routing, Drive-linked docs.
3. **Phase 3 — Intelligence:** Damage/exception flow, vendor cost tracking, manager analytics dashboard.

## 9. Open Questions to Confirm with Client Before/During Build

1. Can the same employee both assemble and QC the same unit, or must it always be a different person?
2. Does procurement need its own login/role, or is that folded into "employee" with a permission flag?
3. Any regulatory/compliance requirement (like your day-job's 21 CFR Part 11 world) that mandates specific audit trail immutability, or is "don't overwrite remarks" sufficient?
4. Who is the actual Zoho sending mailbox for production (vs. your test email currently in use)?
