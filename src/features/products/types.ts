import type { Database } from '@/types/database';
import type { PartWithVendor } from '@/features/vendors/types';
import type { FormDefinition, ProductFormKind } from './formSchemas';

export type Product = Database['public']['Tables']['products']['Row'];
export type Bom = Database['public']['Tables']['bom']['Row'];
export type AssemblyTemplate = Database['public']['Tables']['assembly_templates']['Row'];
export type QcTemplate = Database['public']['Tables']['qc_templates']['Row'];

export type ProductFormRow = {
  id: string;
  product_id: string;
  form_type: ProductFormKind;
  title: string;
  description: string | null;
  definition: FormDefinition;
  updated_at: string;
};

export type ProductHubSummary = {
  product: Product;
  bom_count: number;
  assembly_step_count: number;
  qc_checkpoint_count: number;
  has_installation_form: boolean;
};

export type BomWithPart = Bom & {
  parts: Pick<PartWithVendor, 'id' | 'name' | 'mpn' | 'description'> | null;
};

export type ProductBundle = {
  product: Product;
  bom: BomWithPart[];
  assemblySteps: AssemblyTemplate[];
  qcCheckpoints: QcTemplate[];
};

export type ProductListItem = Product & {
  bom_count: number;
};
