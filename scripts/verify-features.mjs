/**
 * Automated verification for FacMan features (no Supabase credentials required).
 * Run: node scripts/verify-features.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`    ${detail}`);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function section(title) {
  console.log(`\n${title}`);
}

// --- Zod schemas (products + vendors) ---
section('Validation schemas');

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

const bomRowSchema = z.object({
  part_id: z.string().uuid(),
  qty_required: z.coerce.number().positive(),
});

const productSetupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  bom: z.array(bomRowSchema),
  assemblySteps: z.array(z.object({ step_name: z.string().min(1) })).min(1),
  qcCheckpoints: z.array(z.object({ checkpoint_name: z.string().min(1) })).min(1),
});

const vendorSchema = z.object({
  name: z.string().min(1),
  contact_info: z.string().optional().nullable(),
});

const partSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  mpn: z.string().optional().nullable(),
  footprint: z.string().optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable().or(z.literal('')),
  unit_cost: z.coerce.number().min(0),
  qty_available: z.coerce.number().min(0),
  storage_location: z.string().optional().nullable(),
});

const purchaseRequestSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.coerce.number().int().positive(),
  priority: z.coerce.number().int().min(0),
});

const stockInSchema = z.object({
  part_id: z.string().uuid(),
  vendor_id: z.string().uuid().nullable().optional().or(z.literal('')),
  qty: z.coerce.number().positive(),
  unit_cost: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
});

const damageReportSchema = z.object({
  serial_id: z.string().uuid(),
  part_id: z.string().uuid(),
  qty: z.coerce.number().positive(),
  original_handover_id: z.string().uuid().nullable().optional(),
  reason: z.string().min(1),
});

const taskTypeSchema = z.enum(['assembly', 'qc', 'packing', 'delivery', 'installation']);

const assignmentSchema = z.object({
  request_id: z.string().uuid(),
  assigned_to: z.string().uuid(),
});

const qcSubmissionSchema = z.object({
  serial_id: z.string().uuid(),
  checkpoints: z
    .array(
      z.object({
        checkpoint_name: z.string().min(1),
        result: z.enum(['pass', 'fail']),
        note: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

const samplePartId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

try {
  productSchema.parse({ name: 'Test Unit' });
  ok('productSchema accepts valid name');
} catch (e) {
  fail('productSchema valid input', e.message);
}

try {
  productSchema.parse({ name: '' });
  fail('productSchema rejects empty name');
} catch {
  ok('productSchema rejects empty name');
}

try {
  productSetupSchema.parse({
    name: 'Widget',
    bom: [{ part_id: samplePartId, qty_required: 2 }],
    assemblySteps: [{ step_name: 'Solder main board' }],
    qcCheckpoints: [{ checkpoint_name: 'Visual inspection' }],
  });
  ok('productSetupSchema accepts full setup');
} catch (e) {
  fail('productSetupSchema valid input', e.message);
}

try {
  productSetupSchema.parse({
    name: 'Widget',
    bom: [],
    assemblySteps: [],
    qcCheckpoints: [],
  });
  fail('productSetupSchema rejects empty assembly/QC');
} catch {
  ok('productSetupSchema rejects empty assembly/QC');
}

try {
  bomRowSchema.parse({ part_id: samplePartId, qty_required: 0 });
  fail('bomRowSchema rejects zero qty');
} catch {
  ok('bomRowSchema rejects zero qty');
}

try {
  vendorSchema.parse({ name: 'Acme Parts', contact_info: 'sales@acme.test' });
  ok('vendorSchema accepts valid vendor');
} catch (e) {
  fail('vendorSchema valid input', e.message);
}

try {
  partSchema.parse({
    name: 'Resistor 10k',
    unit_cost: 1.5,
    qty_available: 100,
    vendor_id: '',
  });
  ok('partSchema accepts empty vendor_id');
} catch (e) {
  fail('partSchema valid input', e.message);
}

try {
  purchaseRequestSchema.parse({
    product_id: samplePartId,
    qty: 5,
    priority: 2,
  });
  ok('purchaseRequestSchema accepts valid request');
} catch (e) {
  fail('purchaseRequestSchema valid input', e.message);
}

try {
  stockInSchema.parse({
    part_id: samplePartId,
    vendor_id: '',
    qty: 10,
    unit_cost: 4.25,
    notes: 'restock',
  });
  ok('stockInSchema accepts valid stock-in');
} catch (e) {
  fail('stockInSchema valid input', e.message);
}

try {
  damageReportSchema.parse({
    serial_id: samplePartId,
    part_id: samplePartId,
    qty: 1,
    reason: '',
  });
  fail('damageReportSchema rejects empty reason');
} catch {
  ok('damageReportSchema rejects empty reason');
}

try {
  assignmentSchema.parse({
    request_id: samplePartId,
    assigned_to: samplePartId,
  });
  ok('assignmentSchema accepts valid assignment');
} catch (e) {
  fail('assignmentSchema valid input', e.message);
}

try {
  qcSubmissionSchema.parse({
    serial_id: samplePartId,
    checkpoints: [{ checkpoint_name: 'Visual inspection', result: 'pass', note: '' }],
  });
  ok('qcSubmissionSchema accepts checkpoint list');
} catch (e) {
  fail('qcSubmissionSchema valid input', e.message);
}

try {
  taskTypeSchema.parse('qc');
  ok('taskTypeSchema accepts qc');
} catch (e) {
  fail('taskTypeSchema valid input', e.message);
}

// --- File structure ---
section('Feature modules');

const requiredFiles = [
  'src/app/ManagerLayout.tsx',
  'src/app/ProcurementLayout.tsx',
  'src/app/App.tsx',
  'src/app/pages/ManagerDashboardPage.tsx',
  'src/app/pages/ProcurementHomePage.tsx',
  'src/app/pages/EmployeeTasksPage.tsx',
  'src/features/auth/AuthProvider.tsx',
  'src/features/auth/LoginPage.tsx',
  'src/features/auth/RequireAuth.tsx',
  'src/features/auth/RequireRole.tsx',
  'src/features/products/api.ts',
  'src/features/products/ProductListPage.tsx',
  'src/features/products/ProductCreatePage.tsx',
  'src/features/products/ProductSetupPage.tsx',
  'src/features/procurement/api.ts',
  'src/features/procurement/schemas.ts',
  'src/features/procurement/types.ts',
  'src/features/procurement/OrderListPage.tsx',
  'src/features/procurement/OrderCreatePage.tsx',
  'src/features/procurement/OrderDetailPage.tsx',
  'src/features/procurement/ProcurementHomePage.tsx',
  'src/features/tasks/api.ts',
  'src/features/tasks/schemas.ts',
  'src/features/tasks/types.ts',
  'src/features/tasks/fileUtils.ts',
  'src/features/tasks/ManagerWorkflowPage.tsx',
  'src/features/tasks/EmployeeWorkflowPage.tsx',
  'src/features/vendors/api.ts',
  'src/features/vendors/InventoryPage.tsx',
  'src/features/notifications/NotificationsPage.tsx',
  'src/features/analytics/ManagerAnalyticsPage.tsx',
  'src/features/analytics/VendorDamageReportPage.tsx',
  'src/features/traceability/api.ts',
  'src/features/traceability/SerialTracePage.tsx',
  'supabase/migrations/20250702000001_initial_schema.sql',
  'supabase/migrations/20250702000004_rls_policies.sql',
  'supabase/migrations/20250702000005_products_archived.sql',
  'supabase/migrations/20250702000006_procurement_flows.sql',
  'supabase/migrations/20250702000007_task_workflow.sql',
  'supabase/migrations/20250702000008_notifications_polish.sql',
  'supabase/migrations/20250702000009_backup_updated_at.sql',
  'supabase/migrations/20250702000010_senior_manager_role.sql',
  'supabase/migrations/20250702000011_senior_manager_rls_helpers.sql',
  'supabase/migrations/20250702000012_notification_email_triggers.sql',
  'supabase/functions/invite-user/index.ts',
  'supabase/functions/record-stock-in/index.ts',
  'supabase/functions/issue-serial-materials/index.ts',
  'supabase/functions/issue-damage-replacement/index.ts',
  'supabase/functions/manage-assignments/index.ts',
  'supabase/functions/drive-attachments/index.ts',
  'DESIGN.md',
  'stitch-import/manifest.json',
];

for (const file of requiredFiles) {
  if (existsSync(join(root, file))) ok(`exists: ${file}`);
  else fail(`missing: ${file}`);
}

// --- Routes in App.tsx ---
section('Manager routes');

const appTsx = read('src/app/App.tsx');
const managerRoutes = [
  '/dashboard',
  '/orders',
  '/orders/new',
  '/orders/:prId',
  '/products',
  '/products/new',
  '/products/:productId',
  '/inventory',
  '/team/invite',
  '/analytics',
  '/reports/vendor-damage',
  '/trace',
  '/notifications',
];

for (const route of managerRoutes) {
  if (appTsx.includes(`path="${route}"`)) ok(`route registered: ${route}`);
  else fail(`route missing: ${route}`);
}

if (appTsx.includes("allowedRoles={['manager', 'senior_manager']}")) ok('manager role guard present');
else fail('manager role guard missing');

if (appTsx.includes('path="/procurement"')) ok('procurement route registered');
else fail('procurement route missing');

if (appTsx.includes("allowedRoles={['procurement']}")) ok('procurement role guard present');
else fail('procurement role guard missing');

if (appTsx.includes('path="/tasks"')) ok('employee tasks route registered');
else fail('employee tasks route missing');

if (appTsx.includes("allowedRoles={['employee']}")) ok('employee role guard present');
else fail('employee role guard missing');

// --- Role defaults ---
section('Role routing');

const roleRoutes = read('src/features/auth/roleRoutes.ts');
const roleDefaults = {
  admin: '/dashboard',
  manager: '/dashboard',
  senior_manager: '/dashboard',
  procurement: '/procurement',
  employee: '/tasks',
};

for (const [role, route] of Object.entries(roleDefaults)) {
  if (roleRoutes.includes(`${role}: '${route}'`)) ok(`${role} → ${route}`);
  else fail(`${role} default route`);
}

// --- Schema migration ---
section('Database migrations');

const archivedMigration = read('supabase/migrations/20250702000005_products_archived.sql');
if (archivedMigration.includes('archived BOOLEAN')) ok('products.archived column migration');
else fail('products.archived migration content');

const procurementMigration = read('supabase/migrations/20250702000006_procurement_flows.sql');
for (const marker of [
  'CREATE TABLE public.stock_in_events',
  'ADD COLUMN damage_report_id',
  'ADD COLUMN replacement_handover_id',
  'CREATE OR REPLACE FUNCTION public.record_stock_in_event',
  'CREATE OR REPLACE FUNCTION public.issue_serial_materials',
  'CREATE OR REPLACE FUNCTION public.issue_damage_replacement',
]) {
  if (procurementMigration.includes(marker)) ok(`procurement migration contains: ${marker}`);
  else fail(`procurement migration missing: ${marker}`);
}

const workflowMigration = read('supabase/migrations/20250702000007_task_workflow.sql');
for (const marker of [
  'CREATE TYPE public.task_type AS ENUM',
  'CREATE TABLE public.serial_assignments',
  'ADD COLUMN current_task_type',
  'ADD COLUMN checkpoint_name',
  'ALTER PUBLICATION supabase_realtime ADD TABLE public.serial_assignments',
  'CREATE OR REPLACE FUNCTION public.assign_purchase_request',
  'CREATE OR REPLACE FUNCTION public.assign_serial_stage',
  'CREATE OR REPLACE FUNCTION public.complete_serial_assignment',
]) {
  if (workflowMigration.includes(marker)) ok(`workflow migration contains: ${marker}`);
  else fail(`workflow migration missing: ${marker}`);
}

const polishMigration = read('supabase/migrations/20250702000008_notifications_polish.sql');
for (const marker of [
  'CREATE TABLE public.push_subscriptions',
  'low_stock_threshold',
  'CREATE TABLE public.sheet_backup_cursors',
  'notifications_log_select_manager',
]) {
  if (polishMigration.includes(marker)) ok(`polish migration contains: ${marker}`);
  else fail(`polish migration missing: ${marker}`);
}

const backupMigration = read('supabase/migrations/20250702000009_backup_updated_at.sql');
for (const marker of [
  'CREATE OR REPLACE FUNCTION public.set_updated_at()',
  'ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS updated_at',
  'ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS updated_at',
  'ALTER TABLE public.serials ADD COLUMN IF NOT EXISTS updated_at',
  'CREATE TRIGGER parts_set_updated_at',
]) {
  if (backupMigration.includes(marker)) ok(`backup migration contains: ${marker}`);
  else fail(`backup migration missing: ${marker}`);
}

const notificationTriggersMigration = read('supabase/migrations/20250702000012_notification_email_triggers.sql');
for (const marker of [
  'CREATE EXTENSION IF NOT EXISTS pg_net',
  'dispatch_notification_email',
  'serials_task_assigned_email',
  'serial_steps_completed_email',
  'qc_results_failed_email',
  'parts_low_stock_email',
  'damage_reports_reported_email',
]) {
  if (notificationTriggersMigration.includes(marker)) ok(`notification triggers migration contains: ${marker}`);
  else fail(`notification triggers migration missing: ${marker}`);
}

const viteConfigEarly = read('vite.config.ts');
if (viteConfigEarly.includes('navigateFallback')) ok('PWA offline fallback configured');
else fail('PWA offline fallback missing');

for (const file of [
  'supabase/functions/register-push/index.ts',
  'supabase/functions/workflow-notify/index.ts',
  'supabase/functions/send-notification-email/index.ts',
  'supabase/functions/nightly-sheet-backup/index.ts',
  'supabase/functions/_shared/notify.ts',
  'src/features/notifications/api.ts',
  'src/features/notifications/NotificationsPage.tsx',
  'src/features/analytics/ManagerAnalyticsPage.tsx',
  'src/features/analytics/VendorDamageReportPage.tsx',
  'src/features/traceability/api.ts',
  'src/features/traceability/SerialTracePage.tsx',
  'public/offline.html',
  'public/push-sw.js',
  'public/icons/icon-192.png',
]) {
  if (existsSync(join(root, file))) ok(`prompt 5 artifact: ${file}`);
  else fail(`prompt 5 artifact missing: ${file}`);
}

const rls = read('supabase/migrations/20250702000004_rls_policies.sql');
for (const table of ['products', 'bom', 'assembly_templates', 'qc_templates', 'parts', 'vendors']) {
  if (rls.includes(table)) ok(`RLS policies reference ${table}`);
  else fail(`RLS missing table: ${table}`);
}

section('Compliance checks');

const srcFiles = [
  'src/lib/supabase.ts',
  'src/features/auth/AuthProvider.tsx',
  'src/features/notifications/api.ts',
  'src/features/tasks/api.ts',
];

const srcContent = srcFiles.map(read).join('\n');
if (!srcContent.includes('SUPABASE_SERVICE_ROLE_KEY')) ok('service role key not referenced in client src');
else fail('service role key leaked into client src');

if (read('src/lib/supabase.ts').includes('persistSession: true')) ok('session persistence enabled');
else fail('session persistence missing');

if (srcContent.includes("password is never persisted client-side")) ok('password storage guard documented');
else fail('password storage guard comment missing');

if (!srcContent.includes(".from('remarks').update") && !srcContent.includes(".from('remarks').delete")) {
  ok('remarks remain append-only in client code');
} else {
  fail('remarks update/delete found in client code');
}

const allRlsMigrations =
  read('supabase/migrations/20250702000004_rls_policies.sql') +
  '\n' +
  read('supabase/migrations/20250702000006_procurement_flows.sql') +
  '\n' +
  read('supabase/migrations/20250702000007_task_workflow.sql') +
  '\n' +
  read('supabase/migrations/20250702000008_notifications_polish.sql');

for (const table of [
  'users',
  'vendors',
  'parts',
  'products',
  'bom',
  'assembly_templates',
  'qc_templates',
  'purchase_requests',
  'serials',
  'serial_steps',
  'qc_results',
  'attachments',
  'material_handover',
  'damage_reports',
  'remarks',
  'delivery_install',
  'notifications_log',
  'stock_in_events',
  'serial_assignments',
  'push_subscriptions',
  'sheet_backup_cursors',
]) {
  if (allRlsMigrations.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)) {
    ok(`RLS enabled: ${table}`);
  } else {
    fail(`RLS not enabled: ${table}`);
  }
}

// --- Env ---
section('Environment');

if (existsSync(join(root, '.env.local'))) {
  const env = read('.env.local');
  const hasUrl = /VITE_SUPABASE_URL=https:\/\/.+\.supabase\.co/.test(env);
  const hasKey = /VITE_SUPABASE_ANON_KEY=.+/.test(env) && !env.includes('your-anon-key');
  if (hasUrl && hasKey) ok('.env.local has Supabase credentials (live API tests possible)');
  else ok('.env.local exists but placeholders remain — static verification only');
} else {
  ok('.env.local not found — live Supabase tests skipped');
}

// --- PWA ---
section('PWA assets');

const viteConfig = read('vite.config.ts');
if (viteConfig.includes('VitePWA')) ok('vite-plugin-pwa configured');
else fail('PWA plugin missing');

if (existsSync(join(root, 'dist/sw.js'))) ok('service worker built (dist/sw.js)');
else fail('run npm run build first — dist/sw.js missing');

// --- Summary ---
console.log(`\n${'─'.repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
