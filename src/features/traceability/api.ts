import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type UserRef = { id: string; email: string };
type SerialRow = Database['public']['Tables']['serials']['Row'];
type SerialStep = Database['public']['Tables']['serial_steps']['Row'];
type QcResult = Database['public']['Tables']['qc_results']['Row'];
type Remark = Database['public']['Tables']['remarks']['Row'];
type Attachment = Database['public']['Tables']['attachments']['Row'];
type DeliveryInstall = Database['public']['Tables']['delivery_install']['Row'];
type MaterialHandover = Database['public']['Tables']['material_handover']['Row'];
type DamageReport = Database['public']['Tables']['damage_reports']['Row'];
type Assignment = Database['public']['Tables']['serial_assignments']['Row'] & {
  assigned_user?: UserRef | null;
  assigned_by_user?: UserRef | null;
};
type MaterialHandoverWithPart = MaterialHandover & {
  parts?: { id: string; name: string; mpn: string | null } | null;
  issued_by_user?: UserRef | null;
  received_by_user?: UserRef | null;
};
type DamageReportWithPart = DamageReport & {
  parts?: { id: string; name: string; unit_cost: number } | null;
  reported_by_user?: UserRef | null;
  replacement_issued_by_user?: UserRef | null;
};

export type SerialTraceBundle = {
  serial: SerialRow & {
    purchase_requests?: {
      id: string;
      products?: { id: string; name: string } | null;
    } | null;
    packed_by_user?: UserRef | null;
  };
  assignments: Assignment[];
  steps: SerialStep[];
  qcResults: QcResult[];
  attachments: Attachment[];
  handovers: MaterialHandoverWithPart[];
  damageReports: DamageReportWithPart[];
  remarks: Remark[];
  deliveryInstall: DeliveryInstall | null;
  remarkAuthors: Record<string, string>;
};

export async function findSerialByNumber(serialNumber: string): Promise<SerialTraceBundle | null> {
  const { data: serial, error } = await supabase
    .from('serials')
    .select(
      '*, purchase_requests(id, products(id, name)), packed_by_user:users!serials_packed_by_fkey(id, email)',
    )
    .eq('serial_number', serialNumber.trim())
    .maybeSingle();

  if (error) throw error;
  if (!serial) return null;

  const serialId = (serial as { id: string }).id;

  const [assignmentsRes, stepsRes, qcRes, attachmentsRes, handoversRes, damageRes, remarksRes, deliveryRes, usersRes] =
    await Promise.all([
      supabase
        .from('serial_assignments')
        .select(
          '*, assigned_user:users!serial_assignments_assigned_to_fkey(id, email), assigned_by_user:users!serial_assignments_assigned_by_fkey(id, email)',
        )
        .eq('serial_id', serialId)
        .order('assigned_at'),
      supabase.from('serial_steps').select('*').eq('serial_id', serialId).order('started_at'),
      supabase.from('qc_results').select('*').eq('serial_id', serialId).order('checked_at'),
      supabase.from('attachments').select('*').eq('serial_id', serialId).order('uploaded_at'),
      supabase
        .from('material_handover')
        .select(
          '*, parts(id, name, mpn), issued_by_user:users!material_handover_issued_by_fkey(id, email), received_by_user:users!material_handover_received_by_fkey(id, email)',
        )
        .eq('serial_id', serialId)
        .order('issued_at'),
      supabase
        .from('damage_reports')
        .select(
          '*, parts(id, name, unit_cost), reported_by_user:users!damage_reports_reported_by_fkey(id, email), replacement_issued_by_user:users!damage_reports_replacement_issued_by_fkey(id, email)',
        )
        .eq('serial_id', serialId)
        .order('reported_at'),
      supabase.from('remarks').select('*').eq('serial_id', serialId).order('created_at'),
      supabase
        .from('delivery_install')
        .select(
          '*, delivered_by_user:users!delivery_install_delivered_by_fkey(id, email), installed_by_user:users!delivery_install_installed_by_fkey(id, email)',
        )
        .eq('serial_id', serialId)
        .maybeSingle(),
      supabase.from('users').select('id, email'),
    ]);

  if (assignmentsRes.error) throw assignmentsRes.error;
  if (stepsRes.error) throw stepsRes.error;
  if (qcRes.error) throw qcRes.error;
  if (attachmentsRes.error) throw attachmentsRes.error;
  if (handoversRes.error) throw handoversRes.error;
  if (damageRes.error) throw damageRes.error;
  if (remarksRes.error) throw remarksRes.error;
  if (deliveryRes.error) throw deliveryRes.error;
  if (usersRes.error) throw usersRes.error;

  const remarkAuthors: Record<string, string> = {};
  for (const user of usersRes.data ?? []) {
    remarkAuthors[user.id] = user.email;
  }

  return {
    serial: serial as SerialTraceBundle['serial'],
    assignments: (assignmentsRes.data ?? []) as Assignment[],
    steps: stepsRes.data ?? [],
    qcResults: qcRes.data ?? [],
    attachments: attachmentsRes.data ?? [],
    handovers: (handoversRes.data ?? []) as MaterialHandoverWithPart[],
    damageReports: (damageRes.data ?? []) as DamageReportWithPart[],
    remarks: remarksRes.data ?? [],
    deliveryInstall: deliveryRes.data ?? null,
    remarkAuthors,
  };
}
