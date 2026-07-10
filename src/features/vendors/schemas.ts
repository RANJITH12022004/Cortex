import { z } from 'zod';

export const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  contact_info: z.string().optional().nullable(),
});

export const partCatalogSchema = z.object({
  name: z.string().min(1, 'Part name is required'),
  description: z.string().optional().nullable(),
  mpn: z.string().optional().nullable(),
  footprint: z.string().optional().nullable(),
  storage_location: z.string().optional().nullable(),
});

export const partSchema = z.object({
  name: z.string().min(1, 'Part name is required'),
  description: z.string().optional().nullable(),
  mpn: z.string().optional().nullable(),
  footprint: z.string().optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable().or(z.literal('')),
  unit_cost: z.coerce.number().min(0, 'Unit cost must be 0 or greater'),
  qty_available: z.coerce.number().min(0, 'Quantity must be 0 or greater'),
  storage_location: z.string().optional().nullable(),
});

export type PartCatalogFormValues = z.infer<typeof partCatalogSchema>;
export type VendorFormValues = z.infer<typeof vendorSchema>;
export type PartFormValues = z.infer<typeof partSchema>;
