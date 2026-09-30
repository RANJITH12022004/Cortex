import { supabase } from '@/lib/supabase';
import type { PartCatalogFormValues, PartFormValues, VendorFormValues } from './schemas';
import type { PartWithVendor, Vendor } from './types';

function mapVendorId(vendorId: string | null | undefined): string | null {
  if (!vendorId || vendorId === '') return null;
  return vendorId;
}

export async function listVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase.from('vendors').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function createVendor(values: VendorFormValues): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .insert({
      name: values.name,
      contact_info: values.contact_info || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVendor(id: string, values: VendorFormValues): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .update({
      name: values.name,
      contact_info: values.contact_info || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVendor(id: string): Promise<void> {
  const { error } = await supabase.from('vendors').delete().eq('id', id);
  if (error) throw error;
}

export async function listParts(): Promise<PartWithVendor[]> {
  const { data, error } = await supabase
    .from('parts')
    .select('*, vendors(id, name)')
    .order('name');
  if (error) throw error;
  return data as PartWithVendor[];
}

export async function createPartCatalog(values: PartCatalogFormValues): Promise<PartWithVendor> {
  const { data, error } = await supabase
    .from('parts')
    .insert({
      name: values.name,
      description: values.description || null,
      mpn: values.mpn || null,
      footprint: values.footprint || null,
      vendor_id: null,
      unit_cost: 0,
      qty_available: 0,
      storage_location: values.storage_location || null,
    })
    .select('*, vendors(id, name)')
    .single();
  if (error) throw error;
  return data as PartWithVendor;
}

export async function updatePartCatalog(
  id: string,
  values: PartCatalogFormValues,
): Promise<PartWithVendor> {
  const { data, error } = await supabase
    .from('parts')
    .update({
      name: values.name,
      description: values.description || null,
      mpn: values.mpn || null,
      footprint: values.footprint || null,
      storage_location: values.storage_location || null,
    })
    .eq('id', id)
    .select('*, vendors(id, name)')
    .single();
  if (error) throw error;
  return data as PartWithVendor;
}

export async function createPart(values: PartFormValues): Promise<PartWithVendor> {
  const { data, error } = await supabase
    .from('parts')
    .insert({
      name: values.name,
      description: values.description || null,
      mpn: values.mpn || null,
      footprint: values.footprint || null,
      vendor_id: mapVendorId(values.vendor_id),
      unit_cost: values.unit_cost,
      qty_available: values.qty_available,
      storage_location: values.storage_location || null,
    })
    .select('*, vendors(id, name)')
    .single();
  if (error) throw error;
  return data as PartWithVendor;
}

export async function updatePart(id: string, values: PartFormValues): Promise<PartWithVendor> {
  const { data, error } = await supabase
    .from('parts')
    .update({
      name: values.name,
      description: values.description || null,
      mpn: values.mpn || null,
      footprint: values.footprint || null,
      vendor_id: mapVendorId(values.vendor_id),
      unit_cost: values.unit_cost,
      qty_available: values.qty_available,
      storage_location: values.storage_location || null,
    })
    .eq('id', id)
    .select('*, vendors(id, name)')
    .single();
  if (error) throw error;
  return data as PartWithVendor;
}

export async function deletePart(id: string): Promise<void> {
  const { error } = await supabase.from('parts').delete().eq('id', id);
  if (error) throw error;
}

export function friendlyDeleteError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Delete failed';
  if (message.includes('violates foreign key') || message.includes('23503')) {
    return 'This record is referenced by a BOM or other data and cannot be deleted.';
  }
  return message;
}

export type StockOutEventRow = {
  id: string;
  part_id: string;
  qty: number;
  reason: string;
  notes: string | null;
  issued_at: string;
  parts: { id: string; name: string; mpn: string | null; storage_location: string | null } | null;
};

export async function listStockOutEvents(): Promise<StockOutEventRow[]> {
  const { data, error } = await supabase
    .from('stock_out_events')
    .select('id, part_id, qty, reason, notes, issued_at, parts(id, name, mpn, storage_location)')
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StockOutEventRow[];
}

export async function recordStockOut(values: {
  part_id: string;
  box_id: string;
  qty: number;
  reason: string;
  notes?: string | null;
}) {
  const { data, error } = await supabase.functions.invoke('record-stock-out', {
    body: {
      requestId: crypto.randomUUID(),
      partId: values.part_id,
      boxId: values.box_id,
      qty: values.qty,
      reason: values.reason,
      notes: values.notes ?? null,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.event;
}
