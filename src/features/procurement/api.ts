import { supabase } from '@/lib/supabase';
import { dispatchWorkflowNotification } from '@/features/notifications/api';
import type {
  DamageReportFormValues,
  PurchaseRequestFormValues,
  StockInFormValues,
} from './schemas';
import type {
  DamageReportQueueItem,
  DamageReportWithPart,
  EmployeeHandoverItem,
  MaterialHandoverWithPart,
  PartShortfall,
  PurchaseRequestListItem,
  PurchaseRequestWithProduct,
  SerialBomLine,
  SerialIssueBundle,
  SerialWithContext,
  StockInEventWithRelations,
} from './types';

type BomAvailabilityRow = {
  qty_required: number;
  parts: {
    id: string;
    name: string;
    mpn: string | null;
    qty_available: number;
    storage_location: string | null;
  } | null;
};

function normalizeVendorId(vendorId: string | null | undefined): string | null {
  if (!vendorId || vendorId === '') return null;
  return vendorId;
}

function friendlyMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function listActiveProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, archived')
    .eq('archived', false)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function calculateProductShortfalls(
  productId: string,
  qty: number,
): Promise<PartShortfall[]> {
  const { data, error } = await supabase
    .from('bom')
    .select('qty_required, parts(id, name, mpn, qty_available, storage_location)')
    .eq('product_id', productId)
    .order('id');

  if (error) throw error;

  return ((data ?? []) as BomAvailabilityRow[])
    .map((row) => {
      const availableQty = row.parts?.qty_available ?? 0;
      const requiredQty = row.qty_required * qty;
      return {
        part_id: row.parts?.id ?? '',
        part_name: row.parts?.name ?? 'Unknown part',
        mpn: row.parts?.mpn ?? null,
        required_qty: requiredQty,
        available_qty: availableQty,
        shortfall_qty: Math.max(requiredQty - availableQty, 0),
        storage_location: row.parts?.storage_location ?? null,
      };
    })
    .filter((row) => row.shortfall_qty > 0 && row.part_id);
}

export async function createPurchaseRequest(input: PurchaseRequestFormValues & { created_by: string }) {
  const shortfalls = await calculateProductShortfalls(input.product_id, input.qty);
  const status = shortfalls.length === 0 ? 'ready' : 'procurement_hold';

  const { data, error } = await supabase
    .from('purchase_requests')
    .insert({
      product_id: input.product_id,
      qty: input.qty,
      priority: input.priority,
      status,
      created_by: input.created_by,
    })
    .select('*, products(id, name, description, archived)')
    .single();

  if (error) throw error;
  return { request: data as PurchaseRequestWithProduct, shortfalls };
}

export async function listPurchaseRequests(): Promise<PurchaseRequestListItem[]> {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*, products(id, name, description, archived)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  const requests = (data ?? []) as PurchaseRequestWithProduct[];
  const enriched = await Promise.all(
    requests.map(async (request) => ({
      ...request,
      shortfalls:
        request.status === 'procurement_hold'
          ? await calculateProductShortfalls(request.product_id, request.qty)
          : [],
    })),
  );

  return enriched;
}

export async function getPurchaseRequest(prId: string): Promise<PurchaseRequestListItem> {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*, products(id, name, description, archived)')
    .eq('id', prId)
    .single();

  if (error) throw error;

  const request = data as PurchaseRequestWithProduct;
  const shortfalls =
    request.status === 'procurement_hold'
      ? await calculateProductShortfalls(request.product_id, request.qty)
      : [];

  return { ...request, shortfalls };
}

export async function recheckPurchaseRequestAvailability(prId: string): Promise<PurchaseRequestListItem> {
  const current = await getPurchaseRequest(prId);
  const shortfalls = await calculateProductShortfalls(current.product_id, current.qty);

  const { data, error } = await supabase
    .from('purchase_requests')
    .update({
      status: shortfalls.length === 0 ? 'ready' : 'procurement_hold',
    })
    .eq('id', prId)
    .select('*, products(id, name, description, archived)')
    .single();

  if (error) throw error;
  return { ...(data as PurchaseRequestWithProduct), shortfalls };
}

export async function listStockInEvents(): Promise<StockInEventWithRelations[]> {
  const { data, error } = await supabase
    .from('stock_in_events')
    .select('*, parts(id, name, mpn, storage_location), vendors(id, name)')
    .order('received_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as StockInEventWithRelations[];
}

export async function recordStockIn(values: StockInFormValues) {
  const { data, error } = await supabase.functions.invoke('record-stock-in', {
    body: {
      requestId: crypto.randomUUID(),
      partId: values.part_id,
      vendorId: normalizeVendorId(values.vendor_id ?? null),
      qty: values.qty,
      unitCost: values.unit_cost,
      notes: values.notes ?? null,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.event;
}

export async function listProcurementSerials(): Promise<SerialWithContext[]> {
  const { data, error } = await supabase
    .from('serials')
    .select('*, purchase_requests(*, products(id, name, description))')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SerialWithContext[];
}

export async function getSerialIssueBundle(serialId: string): Promise<SerialIssueBundle> {
  const { data: serialData, error: serialError } = await supabase
    .from('serials')
    .select('*, purchase_requests(*, products(id, name, description))')
    .eq('id', serialId)
    .single();

  if (serialError) throw serialError;

  const serial = serialData as SerialWithContext;
  const productId = serial.purchase_requests?.product_id;
  if (!productId) {
    throw new Error('This serial is not linked to a purchase request product.');
  }

  const [bomRes, handoverRes, damageRes] = await Promise.all([
    supabase
      .from('bom')
      .select('part_id, qty_required, parts(id, name, mpn, storage_location, qty_available)')
      .eq('product_id', productId)
      .order('id'),
    supabase
      .from('material_handover')
      .select('*, parts(id, name, mpn, storage_location)')
      .eq('serial_id', serialId)
      .order('issued_at'),
    supabase
      .from('damage_reports')
      .select('*, parts(id, name, mpn, storage_location, unit_cost)')
      .eq('serial_id', serialId)
      .order('reported_at', { ascending: false }),
  ]);

  if (bomRes.error) throw bomRes.error;
  if (handoverRes.error) throw handoverRes.error;
  if (damageRes.error) throw damageRes.error;

  const issuedHandovers = (handoverRes.data ?? []) as MaterialHandoverWithPart[];
  const issuedPartIds = new Set(
    issuedHandovers.filter((row) => row.damage_report_id === null).map((row) => row.part_id),
  );

  const bomLines = ((bomRes.data ?? []) as Array<{
    part_id: string;
    qty_required: number;
    parts: {
      id: string;
      name: string;
      mpn: string | null;
      storage_location: string | null;
      qty_available: number;
    } | null;
  }>).map(
    (row): SerialBomLine => ({
      part_id: row.part_id,
      qty_required: row.qty_required,
      available_qty: row.parts?.qty_available ?? 0,
      already_issued: issuedPartIds.has(row.part_id),
      parts: row.parts
        ? {
            id: row.parts.id,
            name: row.parts.name,
            mpn: row.parts.mpn,
            storage_location: row.parts.storage_location,
          }
        : null,
    }),
  );

  return {
    serial,
    bomLines,
    issuedHandovers,
    damageReports: (damageRes.data ?? []) as DamageReportWithPart[],
  };
}

export async function issueSerialMaterials(serialId: string) {
  const { data, error } = await supabase.functions.invoke('issue-serial-materials', {
    body: { serialId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.handovers ?? []) as MaterialHandoverWithPart[];
}

export async function listOpenDamageReports(): Promise<DamageReportQueueItem[]> {
  const { data, error } = await supabase
    .from('damage_reports')
    .select('*, parts(id, name, mpn, storage_location, unit_cost), serials(id, serial_number, current_stage)')
    .is('replacement_handover_id', null)
    .order('reported_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DamageReportQueueItem[];
}

export async function issueDamageReplacement(damageReportId: string) {
  const { data, error } = await supabase.functions.invoke('issue-damage-replacement', {
    body: { damageReportId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.handover;
}

export async function listEmployeePendingHandovers(): Promise<EmployeeHandoverItem[]> {
  const { data, error } = await supabase
    .from('material_handover')
    .select('*, parts(id, name, mpn, storage_location), serials(id, serial_number, current_stage)')
    .is('received_by', null)
    .order('issued_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as EmployeeHandoverItem[];
}

export async function listEmployeeHandovers(): Promise<EmployeeHandoverItem[]> {
  const { data, error } = await supabase
    .from('material_handover')
    .select('*, parts(id, name, mpn, storage_location), serials(id, serial_number, current_stage)')
    .order('issued_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as EmployeeHandoverItem[];
}

export async function confirmMaterialHandover(handoverId: string, receivedBy: string) {
  const { data, error } = await supabase
    .from('material_handover')
    .update({
      received_by: receivedBy,
      received_at: new Date().toISOString(),
    })
    .eq('id', handoverId)
    .select('*, parts(id, name, mpn, storage_location), serials(id, serial_number, current_stage)')
    .single();

  if (error) throw error;
  return data as EmployeeHandoverItem;
}

export async function reportDamage(values: DamageReportFormValues & { reported_by: string }) {
  const { data, error } = await supabase
    .from('damage_reports')
    .insert({
      serial_id: values.serial_id,
      part_id: values.part_id,
      qty: values.qty,
      original_handover_id: values.original_handover_id ?? null,
      reason: values.reason,
      reported_by: values.reported_by,
    })
    .select('*, parts(id, name, mpn, storage_location, unit_cost), serials(id, serial_number, current_stage)')
    .single();

  if (error) throw error;

  const report = data as DamageReportQueueItem;

  void dispatchWorkflowNotification({
    eventType: 'damage_reported',
    damageReportId: report.id,
  }).catch(() => undefined);

  return report;
}

export function friendlyProcurementError(error: unknown, fallback = 'Operation failed') {
  const message = friendlyMessage(error, fallback);

  if (message.includes('Insufficient stock')) {
    return message;
  }

  if (message.includes('duplicate key value')) {
    return 'This action was already completed and will not be applied twice.';
  }

  return message;
}
