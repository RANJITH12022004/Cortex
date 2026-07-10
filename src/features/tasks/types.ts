import type { Database, TaskType } from '@/types/database';

export type UserProfile = Database['public']['Tables']['users']['Row'];
export type PurchaseRequest = Database['public']['Tables']['purchase_requests']['Row'];
export type Serial = Database['public']['Tables']['serials']['Row'];
export type SerialAssignment = Database['public']['Tables']['serial_assignments']['Row'];
export type SerialStep = Database['public']['Tables']['serial_steps']['Row'];
export type QcResult = Database['public']['Tables']['qc_results']['Row'];
export type Attachment = Database['public']['Tables']['attachments']['Row'];
export type DeliveryInstall = Database['public']['Tables']['delivery_install']['Row'];
export type Remark = Database['public']['Tables']['remarks']['Row'];

export type EmployeeStatusItem = Pick<UserProfile, 'id' | 'email' | 'role' | 'active'> & {
  activeAssignment: (Pick<SerialAssignment, 'id' | 'task_type' | 'assigned_at'> & {
    serials: Pick<Serial, 'id' | 'serial_number' | 'current_stage'> | null;
  }) | null;
};

export type ReadyRequestItem = PurchaseRequest & {
  products: { id: string; name: string; description: string | null } | null;
};

export type SerialAssignmentWithContext = SerialAssignment & {
  serials: (Serial & {
    purchase_requests: (PurchaseRequest & {
      products: { id: string; name: string; description: string | null } | null;
    }) | null;
  }) | null;
  assigned_user: Pick<UserProfile, 'id' | 'email' | 'role'> | null;
  assigned_by_user: Pick<UserProfile, 'id' | 'email' | 'role'> | null;
};

export type AttachmentWithMeta = Attachment & {
  task_type: TaskType | null;
  checkpoint_name: string | null;
};

export type SerialStepWithAttachments = SerialStep & {
  attachments: AttachmentWithMeta[];
};

export type QcCheckpointDraft = {
  checkpoint_name: string;
  result: 'pass' | 'fail';
  note: string;
  attachments: AttachmentWithMeta[];
};

export type ActiveTaskBundle = {
  assignment: SerialAssignmentWithContext;
  serial: Serial;
  serialSteps: SerialStepWithAttachments[];
  qcTemplates: Array<{ checkpoint_order: number; checkpoint_name: string }>;
  latestQcResults: QcResult[];
  attachments: AttachmentWithMeta[];
  remarks: Remark[];
  deliveryInstall: DeliveryInstall | null;
};
