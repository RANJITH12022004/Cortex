import { supabase } from '@/lib/supabase';

export type EmployeeAnalyticsRow = {
  employeeId: string;
  email: string;
  completedTasks: number;
  avgCompletionMinutes: number | null;
  qcChecks: number;
  qcPasses: number;
  qcPassRate: number | null;
};

export type VendorDamageRow = {
  vendorId: string | null;
  vendorName: string;
  partId: string;
  partName: string;
  unitsWasted: number;
  rupeesWasted: number;
};

function minutesBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return null;
  return ms / 60000;
}

export async function fetchEmployeeAnalytics(): Promise<EmployeeAnalyticsRow[]> {
  const [employeesRes, assignmentsRes, stepsRes, qcRes] = await Promise.all([
    supabase.from('users').select('id, email').eq('role', 'employee').eq('active', true),
    supabase.from('serial_assignments').select('assigned_to, completed_at').not('completed_at', 'is', null),
    supabase.from('serial_steps').select('done_by, started_at, completed_at').eq('status', 'completed'),
    supabase.from('qc_results').select('checked_by, result'),
  ]);

  if (employeesRes.error) throw employeesRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;
  if (stepsRes.error) throw stepsRes.error;
  if (qcRes.error) throw qcRes.error;

  return (employeesRes.data ?? []).map((employee) => {
    const assignments = (assignmentsRes.data ?? []).filter((row) => row.assigned_to === employee.id);
    const steps = (stepsRes.data ?? []).filter((row) => row.done_by === employee.id);
    const qcRows = (qcRes.data ?? []).filter((row) => row.checked_by === employee.id);
    const qcPasses = qcRows.filter((row) => row.result === 'pass').length;

    const durations = steps
      .map((step) => minutesBetween(step.started_at, step.completed_at))
      .filter((value): value is number => value !== null);
    const avgCompletionMinutes =
      durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;

    return {
      employeeId: employee.id,
      email: employee.email,
      completedTasks: assignments.length,
      avgCompletionMinutes,
      qcChecks: qcRows.length,
      qcPasses,
      qcPassRate: qcRows.length > 0 ? (qcPasses / qcRows.length) * 100 : null,
    };
  });
}

export async function fetchVendorDamageReport(from: string, to: string): Promise<VendorDamageRow[]> {
  const { data, error } = await supabase
    .from('damage_reports')
    .select('id, qty, reported_at, parts(id, name, unit_cost, vendor_id, vendors(id, name))')
    .gte('reported_at', from)
    .lte('reported_at', to);

  if (error) throw error;

  type DamageRow = {
    id: string;
    qty: number;
    reported_at: string;
    parts: {
      id: string;
      name: string;
      unit_cost: number;
      vendor_id: string | null;
      vendors: { id: string; name: string } | null;
    } | null;
  };

  const rows = (data ?? []) as DamageRow[];
  const grouped = new Map<string, VendorDamageRow>();

  for (const row of rows) {
    const part = row.parts as {
      id: string;
      name: string;
      unit_cost: number;
      vendor_id: string | null;
      vendors: { id: string; name: string } | null;
    } | null;
    if (!part) continue;

    const qty = Number(row.qty ?? 1);
    const key = `${part.vendor_id ?? 'none'}:${part.id}`;
    const existing = grouped.get(key) ?? {
      vendorId: part.vendor_id,
      vendorName: part.vendors?.name ?? 'Unassigned vendor',
      partId: part.id,
      partName: part.name,
      unitsWasted: 0,
      rupeesWasted: 0,
    };

    existing.unitsWasted += qty;
    existing.rupeesWasted += Number(part.unit_cost) * qty;
    grouped.set(key, existing);
  }

  return [...grouped.values()].sort((a, b) => b.rupeesWasted - a.rupeesWasted);
}
