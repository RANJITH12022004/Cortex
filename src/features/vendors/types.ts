import type { Database } from '@/types/database';

export type Vendor = Database['public']['Tables']['vendors']['Row'];
export type Part = Database['public']['Tables']['parts']['Row'];

export type PartWithVendor = Part & {
  vendors: Pick<Vendor, 'id' | 'name'> | null;
};
