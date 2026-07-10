import { z } from 'zod';

export const taskTypeSchema = z.enum(['assembly', 'qc', 'packing', 'delivery', 'installation']);

export const assignPurchaseRequestSchema = z.object({
  request_id: z.string().uuid(),
  assigned_to: z.string().uuid('Select an employee'),
});

export const assignSerialStageSchema = z.object({
  serial_id: z.string().uuid(),
  task_type: taskTypeSchema,
  assigned_to: z.string().uuid('Select an employee'),
});

export const serialStepUpdateSchema = z.object({
  step_id: z.string().uuid(),
  status: z.enum(['in_progress', 'completed']),
});

export const qcCheckpointSchema = z.object({
  checkpoint_name: z.string().min(1),
  result: z.enum(['pass', 'fail']),
  note: z.string().max(1000).optional().nullable(),
});

export const qcSubmissionSchema = z.object({
  serial_id: z.string().uuid(),
  checkpoints: z.array(qcCheckpointSchema).min(1),
});

export const attachmentUploadSchema = z.object({
  serial_id: z.string().uuid(),
  step_name: z.string().min(1),
  task_type: taskTypeSchema.nullable().optional(),
  checkpoint_name: z.string().nullable().optional(),
  file_name: z.string().min(1),
  file_type: z.string().min(1),
  content_base64: z.string().min(1),
});

export const stageRemarkSchema = z.object({
  serial_id: z.string().uuid(),
  step_name: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export const packingCompletionSchema = z.object({
  serial_id: z.string().uuid(),
});

export const deliverySchema = z.object({
  serial_id: z.string().uuid(),
  delivery_partner: z.string().min(1, 'Delivery partner is required'),
  delivery_docs_link: z.string().url('Use a valid document link').optional().nullable().or(z.literal('')),
  remark: z.string().max(2000).optional().nullable(),
});

export const installationSchema = z.object({
  serial_id: z.string().uuid(),
  installation_docs_link: z.string().url('Use a valid document link').optional().nullable().or(z.literal('')),
  remark: z.string().max(2000).optional().nullable(),
});

export type AssignPurchaseRequestValues = z.infer<typeof assignPurchaseRequestSchema>;
export type AssignSerialStageValues = z.infer<typeof assignSerialStageSchema>;
export type QcSubmissionValues = z.infer<typeof qcSubmissionSchema>;
export type DeliveryValues = z.infer<typeof deliverySchema>;
export type InstallationValues = z.infer<typeof installationSchema>;
