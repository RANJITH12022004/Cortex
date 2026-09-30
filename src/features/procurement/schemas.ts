import { z } from 'zod';

export const purchaseRequestSchema = z.object({
  product_id: z.string().uuid('Select a product'),
  qty: z.coerce.number().int().positive('Quantity must be greater than 0'),
  priority: z.coerce.number().int().min(0, 'Priority must be 0 or greater'),
});

export const partShortfallSchema = z.object({
  part_id: z.string().uuid(),
  part_name: z.string(),
  mpn: z.string().nullable(),
  required_qty: z.number(),
  available_qty: z.number(),
  shortfall_qty: z.number(),
  storage_location: z.string().nullable(),
});

export const stockInSchema = z.object({
  part_id: z.string().uuid('Select a part'),
  box_id: z.string().uuid('Select a box'),
  vendor_id: z.string().uuid().nullable().optional().or(z.literal('')),
  qty: z.coerce.number().positive('Quantity must be greater than 0'),
  unit_cost: z.coerce.number().min(0, 'Unit cost must be 0 or greater'),
  notes: z.string().max(500, 'Notes must be 500 characters or fewer').optional().nullable(),
});

export const serialIssueSchema = z.object({
  serial_id: z.string().uuid(),
});

export const handoverConfirmationSchema = z.object({
  handover_id: z.string().uuid(),
});

export const damageReportSchema = z.object({
  serial_id: z.string().uuid(),
  part_id: z.string().uuid('Select a part'),
  qty: z.coerce.number().positive('Quantity must be greater than 0'),
  original_handover_id: z.string().uuid().nullable().optional(),
  reason: z.string().min(1, 'Reason is required').max(1000, 'Reason is too long'),
});

export const damageReplacementSchema = z.object({
  damage_report_id: z.string().uuid(),
});

export type PurchaseRequestFormValues = z.infer<typeof purchaseRequestSchema>;
export type StockInFormValues = z.infer<typeof stockInSchema>;
export type DamageReportFormValues = z.infer<typeof damageReportSchema>;
