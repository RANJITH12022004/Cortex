import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional().nullable(),
});

export const bomRowSchema = z.object({
  part_id: z.string().uuid('Select a part'),
  qty_required: z.coerce.number().positive('Quantity must be greater than 0'),
});

export const assemblyStepSchema = z.object({
  step_name: z.string().min(1, 'Step name is required'),
});

export const qcCheckpointSchema = z.object({
  checkpoint_name: z.string().min(1, 'Checkpoint name is required'),
});

export const bomOnlySchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional().nullable(),
  bom: z.array(bomRowSchema),
});

export const productSetupSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional().nullable(),
  bom: z.array(bomRowSchema),
  assemblySteps: z.array(assemblyStepSchema).min(1, 'Add at least one assembly step'),
  qcCheckpoints: z.array(qcCheckpointSchema).min(1, 'Add at least one QC checkpoint'),
});

export type BomOnlyFormValues = z.infer<typeof bomOnlySchema>;

export type ProductFormValues = z.infer<typeof productSchema>;
export type BomRowFormValues = z.infer<typeof bomRowSchema>;
export type ProductSetupFormValues = z.infer<typeof productSetupSchema>;
