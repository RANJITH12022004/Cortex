import { z } from 'zod';

export const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  contact_info: z.string().optional().nullable(),
});

export const rackSchema = z.object({
  code: z.string().trim().min(1, 'Rack code is required').max(40),
  name: z.string().trim().max(120).optional().nullable(),
});

export const boxSchema = z.object({
  rack_id: z.string().uuid('Select a rack'),
  code: z.string().trim().min(1, 'Box code is required').max(40),
  name: z.string().trim().max(120).optional().nullable(),
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

export type RackFormValues = z.infer<typeof rackSchema>;
export type BoxFormValues = z.infer<typeof boxSchema>;
export type PartCatalogFormValues = z.infer<typeof partCatalogSchema>;
export type VendorFormValues = z.infer<typeof vendorSchema>;
export type PartFormValues = z.infer<typeof partSchema>;
