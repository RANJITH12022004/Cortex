import { supabase } from '@/lib/supabase';
import type { TaskType } from '@/types/database';
import type {
  ActiveTaskBundle,
  AttachmentWithMeta,
  EmployeeStatusItem,
  ReadyRequestItem,
  SerialAssignmentWithContext,
  SerialStepWithAttachments,
} from './types';
import type {
  DeliveryValues,
  InstallationValues,
  QcSubmissionValues,
} from './schemas';
import { dispatchWorkflowNotification } from '@/features/notifications/api';

function friendlyMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function listAssignableEmployees() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, active')
    .eq('role', 'employee')
    .eq('active', true)
    .order('email');

  if (error) throw error;
  return data ?? [];
}

export async function listEmployeeStatuses(): Promise<EmployeeStatusItem[]> {
  const [employeesRes, assignmentsRes] = await Promise.all([
    supabase.from('users').select('id, email, role, active').eq('role', 'employee').eq('active', true),
    supabase
      .from('serial_assignments')
      .select('id, task_type, assigned_at, assigned_to, serials(id, serial_number, current_stage)')
      .is('completed_at', null),
  ]);

  if (employeesRes.error) throw employeesRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;

  const assignmentRows = (assignmentsRes.data ?? []) as Array<
    NonNullable<EmployeeStatusItem['activeAssignment']> & { assigned_to: string }
  >;
  const assignmentMap = new Map(assignmentRows.map((row) => [row.assigned_to, row]));

  return (employeesRes.data ?? []).map((employee) => ({
    ...employee,
    activeAssignment: assignmentMap.get(employee.id) ?? null,
  }));
}

export async function listReadyPurchaseRequests(): Promise<ReadyRequestItem[]> {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*, products(id, name, description)')
    .eq('status', 'ready')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ReadyRequestItem[];
}

export async function listOpenAssignments(): Promise<SerialAssignmentWithContext[]> {
  const { data, error } = await supabase
    .from('serial_assignments')
    .select(
      '*, serials(*, purchase_requests(*, products(id, name, description))), assigned_user:users!serial_assignments_assigned_to_fkey(id, email, role), assigned_by_user:users!serial_assignments_assigned_by_fkey(id, email, role)',
    )
    .is('completed_at', null)
    .order('assigned_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SerialAssignmentWithContext[];
}

export async function assignPurchaseRequest(requestId: string, assignedTo: string) {
  const { data, error } = await supabase.functions.invoke('manage-assignments', {
    body: {
      action: 'assign_purchase_request',
      requestId,
      assignedTo,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.serials ?? [];
}

export async function assignSerialStage(serialId: string, taskType: TaskType, assignedTo: string) {
  const { data, error } = await supabase.functions.invoke('manage-assignments', {
    body: {
      action: 'assign_serial_stage',
      serialId,
      taskType,
      assignedTo,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.assignment;
}

export async function listMyAssignments(userId: string): Promise<SerialAssignmentWithContext[]> {
  const { data, error } = await supabase
    .from('serial_assignments')
    .select(
      '*, serials(*, purchase_requests(*, products(id, name, description))), assigned_user:users!serial_assignments_assigned_to_fkey(id, email, role), assigned_by_user:users!serial_assignments_assigned_by_fkey(id, email, role)',
    )
    .eq('assigned_to', userId)
    .is('completed_at', null)
    .order('assigned_at');

  if (error) throw error;
  return (data ?? []) as SerialAssignmentWithContext[];
}

export async function getActiveTaskBundle(serialId: string): Promise<ActiveTaskBundle> {
  const [assignmentRes, stepsRes, qcTemplatesRes, qcResultsRes, attachmentsRes, remarksRes, deliveryRes] =
    await Promise.all([
      supabase
        .from('serial_assignments')
        .select(
          '*, serials(*, purchase_requests(*, products(id, name, description))), assigned_user:users!serial_assignments_assigned_to_fkey(id, email, role), assigned_by_user:users!serial_assignments_assigned_by_fkey(id, email, role)',
        )
        .eq('serial_id', serialId)
        .is('completed_at', null)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .single(),
      supabase.from('serial_steps').select('*').eq('serial_id', serialId).order('started_at'),
      supabase
        .from('serials')
        .select('purchase_requests(product_id)')
        .eq('id', serialId)
        .single(),
      supabase.from('qc_results').select('*').eq('serial_id', serialId).order('checked_at'),
      supabase.from('attachments').select('*').eq('serial_id', serialId).order('uploaded_at'),
      supabase.from('remarks').select('*').eq('serial_id', serialId).order('created_at'),
      supabase.from('delivery_install').select('*').eq('serial_id', serialId).maybeSingle(),
    ]);

  if (assignmentRes.error) throw assignmentRes.error;
  if (stepsRes.error) throw stepsRes.error;
  if (qcTemplatesRes.error) throw qcTemplatesRes.error;
  if (qcResultsRes.error) throw qcResultsRes.error;
  if (attachmentsRes.error) throw attachmentsRes.error;
  if (remarksRes.error) throw remarksRes.error;
  if (deliveryRes.error) throw deliveryRes.error;

  const assignment = assignmentRes.data as SerialAssignmentWithContext;
  const serial = assignment.serials;
  const productId = serial?.purchase_requests?.product_id;
  let qcTemplates: Array<{ checkpoint_order: number; checkpoint_name: string }> = [];

  if (productId) {
    const { data, error } = await supabase
      .from('qc_templates')
      .select('checkpoint_order, checkpoint_name')
      .eq('product_id', productId)
      .order('checkpoint_order');
    if (error) throw error;
    qcTemplates = data ?? [];
  }

  const attachments = (attachmentsRes.data ?? []) as AttachmentWithMeta[];
  const steps = ((stepsRes.data ?? []) as SerialStepWithAttachments[]).map((step) => ({
    ...step,
    attachments: attachments.filter(
      (attachment) =>
        attachment.task_type === 'assembly' &&
        attachment.step_name === step.step_name &&
        attachment.checkpoint_name === null,
    ),
  }));

  return {
    assignment,
    serial: serial!,
    serialSteps: steps,
    qcTemplates,
    latestQcResults: qcResultsRes.data ?? [],
    attachments,
    remarks: remarksRes.data ?? [],
    deliveryInstall: deliveryRes.data ?? null,
  };
}

export async function updateSerialStep(stepId: string, status: 'in_progress' | 'completed', actorId: string) {
  const payload: {
    status: string;
    started_at?: string;
    completed_at?: string;
    done_by?: string;
  } = { status };

  if (status === 'in_progress') {
    payload.started_at = new Date().toISOString();
  } else {
    payload.completed_at = new Date().toISOString();
    payload.done_by = actorId;
  }

  const { data, error } = await supabase
    .from('serial_steps')
    .update(payload)
    .eq('id', stepId)
    .select('*')
    .single();

  if (error) throw error;

  if (status === 'completed' && data) {
    void dispatchWorkflowNotification({
      eventType: 'step_completed',
      serialId: data.serial_id,
      stepName: data.step_name,
    }).catch(() => undefined);
  }

  return data;
}

export async function completeAssignment(serialId: string, taskType: TaskType, actorId: string, nextStage: string) {
  const { data, error } = await supabase.functions.invoke('manage-assignments', {
    body: {
      action: 'complete_assignment',
      serialId,
      taskType,
      actorId,
      nextStage,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.serial;
}

export async function submitQcResults(values: QcSubmissionValues, actorId: string) {
  const rows = values.checkpoints.map((checkpoint) => ({
    serial_id: values.serial_id,
    checkpoint_name: checkpoint.checkpoint_name,
    result: checkpoint.result,
    note: checkpoint.note || null,
    checked_by: actorId,
  }));

  const { data, error } = await supabase.from('qc_results').insert(rows).select('*');
  if (error) throw error;

  const hasFailure = values.checkpoints.some((checkpoint) => checkpoint.result === 'fail');
  if (hasFailure) {
    await completeAssignment(values.serial_id, 'qc', actorId, 'rework');
    await supabase
      .from('serials')
      .update({
        current_stage: 'rework',
        current_task_type: 'assembly',
      })
      .eq('id', values.serial_id);

    void dispatchWorkflowNotification({
      eventType: 'qc_failed',
      serialId: values.serial_id,
    }).catch(() => undefined);
  } else {
    await completeAssignment(values.serial_id, 'qc', actorId, 'qc_passed');
  }

  return data ?? [];
}

export async function addRemark(serialId: string, stepName: string, authorId: string, text: string) {
  const { data, error } = await supabase
    .from('remarks')
    .insert({
      serial_id: serialId,
      step_name: stepName,
      author: authorId,
      text,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function uploadAttachment(input: {
  serialId: string;
  stepName: string;
  taskType: TaskType | null;
  checkpointName?: string | null;
  fileName: string;
  fileType: string;
  contentBase64: string;
}) {
  const { data, error } = await supabase.functions.invoke('drive-attachments', {
    body: {
      action: 'upload',
      serial_id: input.serialId,
      step_name: input.stepName,
      task_type: input.taskType,
      checkpoint_name: input.checkpointName ?? null,
      file_name: input.fileName,
      file_type: input.fileType,
      content_base64: input.contentBase64,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.attachment as AttachmentWithMeta;
}

export async function deleteAttachment(attachmentId: string) {
  const { data, error } = await supabase.functions.invoke('drive-attachments', {
    body: {
      action: 'delete',
      attachment_id: attachmentId,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function completePacking(serialId: string, actorId: string) {
  const { error } = await supabase
    .from('serials')
    .update({
      packed_by: actorId,
      packed_at: new Date().toISOString(),
      current_stage: 'packed',
    })
    .eq('id', serialId);
  if (error) throw error;
  return completeAssignment(serialId, 'packing', actorId, 'packed');
}

export async function saveDelivery(values: DeliveryValues, actorId: string) {
  const { error } = await supabase.from('delivery_install').upsert({
    serial_id: values.serial_id,
    delivery_partner: values.delivery_partner,
    delivery_docs_link: values.delivery_docs_link || null,
    delivered_by: actorId,
    delivered_at: new Date().toISOString(),
  });
  if (error) throw error;

  if (values.remark) {
    await addRemark(values.serial_id, 'delivery', actorId, values.remark);
  }

  return completeAssignment(values.serial_id, 'delivery', actorId, 'delivered');
}

export async function saveInstallation(values: InstallationValues, actorId: string) {
  const { error } = await supabase.from('delivery_install').upsert({
    serial_id: values.serial_id,
    installation_docs_link: values.installation_docs_link || null,
    installed_by: actorId,
    installed_at: new Date().toISOString(),
  });
  if (error) throw error;

  if (values.remark) {
    await addRemark(values.serial_id, 'installation', actorId, values.remark);
  }

  return completeAssignment(values.serial_id, 'installation', actorId, 'installed');
}

export function subscribeToWorkflowChanges(onChange: () => void) {
  return supabase
    .channel(`workflow-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'serials' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'serial_steps' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'serial_assignments' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'qc_results' }, onChange)
    .subscribe();
}

export function friendlyTaskError(error: unknown, fallback = 'Operation failed') {
  const message = friendlyMessage(error, fallback);
  if (message.includes('QC must be assigned')) {
    return message;
  }
  if (message.includes('Only ready requests can be assigned')) {
    return message;
  }
  return message;
}
