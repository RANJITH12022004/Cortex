import type { Database } from '@/types/database';

export type Product = Database['public']['Tables']['products']['Row'];
export type Part = Database['public']['Tables']['parts']['Row'];
export type Vendor = Database['public']['Tables']['vendors']['Row'];
export type PurchaseRequest = Database['public']['Tables']['purchase_requests']['Row'];
export type Serial = Database['public']['Tables']['serials']['Row'];
export type MaterialHandover = Database['public']['Tables']['material_handover']['Row'];
export type DamageReport = Database['public']['Tables']['damage_reports']['Row'];
export type StockInEvent = Database['public']['Tables']['stock_in_events']['Row'];

export type PartShortfall = {
  part_id: string;
  part_name: string;
  mpn: string | null;
  required_qty: number;
  available_qty: number;
  shortfall_qty: number;
  storage_location: string | null;
};

export type PurchaseRequestWithProduct = PurchaseRequest & {
  products: Pick<Product, 'id' | 'name' | 'description' | 'archived'> | null;
};

export type PurchaseRequestListItem = PurchaseRequestWithProduct & {
  shortfalls: PartShortfall[];
};

export type StockInEventWithRelations = StockInEvent & {
  parts: Pick<Part, 'id' | 'name' | 'mpn' | 'storage_location'> | null;
  vendors: Pick<Vendor, 'id' | 'name'> | null;
};

export type MaterialHandoverWithPart = MaterialHandover & {
  parts: Pick<Part, 'id' | 'name' | 'mpn' | 'storage_location'> | null;
};

export type DamageReportWithPart = DamageReport & {
  parts: Pick<Part, 'id' | 'name' | 'mpn' | 'storage_location' | 'unit_cost'> | null;
};

export type DamageReportQueueItem = DamageReportWithPart & {
  serials: Pick<Serial, 'id' | 'serial_number' | 'current_stage'> | null;
};

export type SerialWithContext = Serial & {
  purchase_requests: (PurchaseRequest & {
    products: Pick<Product, 'id' | 'name' | 'description'> | null;
  }) | null;
};

export type SerialBomLine = {
  part_id: string;
  qty_required: number;
  available_qty: number;
  already_issued: boolean;
  parts: Pick<Part, 'id' | 'name' | 'mpn' | 'storage_location'> | null;
};

export type SerialIssueBundle = {
  serial: SerialWithContext;
  bomLines: SerialBomLine[];
  issuedHandovers: MaterialHandoverWithPart[];
  damageReports: DamageReportWithPart[];
};

export type EmployeeHandoverItem = MaterialHandoverWithPart & {
  serials: Pick<Serial, 'id' | 'serial_number' | 'current_stage'> | null;
};
