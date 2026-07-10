import { z } from 'zod';

export const stockOutSchema = z.object({
  part_id: z.string().uuid('Select a part'),
  qty: z.coerce.number().positive('Quantity must be greater than 0'),
  reason: z.string().min(1, 'Reason is required').max(200),
  notes: z.string().max(500).optional().nullable(),
});

export type StockOutFormValues = z.infer<typeof stockOutSchema>;
