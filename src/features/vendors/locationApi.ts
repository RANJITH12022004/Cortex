import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { BoxFormValues, RackFormValues } from './schemas';
import type { PartWithVendor } from './types';

export type Rack = Database['public']['Tables']['racks']['Row'];
export type Box = Database['public']['Tables']['boxes']['Row'];

export type BoxWithRack = Box & {
  racks: Pick<Rack, 'id' | 'code' | 'name'> | null;
};

export type InventoryHit = Database['public']['Functions']['search_inventory']['Returns'][number];

const PAGE_SIZE = 50;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('You must be signed in.');
  }
  return data.user.id;
}

export async function searchInventory(query: string, offset: number): Promise<InventoryHit[]> {
  const { data, error } = await supabase.rpc('search_inventory', {
    p_query: query,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;
  return data ?? [];
}

export async function searchParts(query: string): Promise<PartWithVendor[]> {
  let request = supabase.from('parts').select('*, vendors(id, name)').order('name').limit(PAGE_SIZE);
  const term = query.trim();
  if (term) {
    const safe = term.replace(/[%_,]/g, '');
    request = request.or(`name.ilike.%${safe}%,mpn.ilike.%${safe}%`);
  }
  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as unknown as PartWithVendor[];
}

export async function listRacks(query: string): Promise<Rack[]> {
  let request = supabase.from('racks').select('*').order('code').limit(PAGE_SIZE);
  const term = query.trim();
  if (term) {
    const safe = term.replace(/[%_,]/g, '');
    request = request.or(`code.ilike.%${safe}%,name.ilike.%${safe}%`);
  }
  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export async function createRack(values: RackFormValues): Promise<Rack> {
  const createdBy = await currentUserId();
  const { data, error } = await supabase
    .from('racks')
    .insert({
      code: normalizeCode(values.code),
      name: values.name?.trim() || null,
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRack(id: string, values: RackFormValues): Promise<Rack> {
  const { data, error } = await supabase
    .from('racks')
    .update({
      code: normalizeCode(values.code),
      name: values.name?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRack(id: string): Promise<void> {
  const { error } = await supabase.from('racks').delete().eq('id', id);
  if (error) throw error;
}

export async function listBoxes(query: string): Promise<BoxWithRack[]> {
  let request = supabase
    .from('boxes')
    .select('id, rack_id, code, name, created_by, created_at, racks(id, code, name)')
    .order('code')
    .limit(PAGE_SIZE);
  const term = query.trim();
  if (term) {
    const safe = term.replace(/[%_,]/g, '');
    request = request.or(`code.ilike.%${safe}%,name.ilike.%${safe}%`);
  }
  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as unknown as BoxWithRack[];
}

export async function createBox(values: BoxFormValues): Promise<Box> {
  const createdBy = await currentUserId();
  const { data, error } = await supabase
    .from('boxes')
    .insert({
      rack_id: values.rack_id,
      code: normalizeCode(values.code),
      name: values.name?.trim() || null,
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBox(id: string, values: BoxFormValues): Promise<Box> {
  const { data, error } = await supabase
    .from('boxes')
    .update({
      rack_id: values.rack_id,
      code: normalizeCode(values.code),
      name: values.name?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBox(id: string): Promise<void> {
  const { error } = await supabase.from('boxes').delete().eq('id', id);
  if (error) throw error;
}

export const INVENTORY_PAGE_SIZE = PAGE_SIZE;

export const INVENTORY_CSV_HEADER =
  'part_name,description,mpn,footprint,vendor_name,unit_cost,rack_code,rack_name,box_code,box_name,qty';

export async function importInventoryCsv(csv: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke('import-inventory-csv', {
    body: { csv },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return Number(data?.imported ?? 0);
}
