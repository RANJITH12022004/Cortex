import { createServiceClient, notifyUser } from './notify.ts';

type AssignmentNotifyInput = {
  assignedTo: string;
  serialNumber: string;
  taskType: string;
  productName?: string;
};

export async function notifyTaskAssignment(input: AssignmentNotifyInput) {
  const adminClient = createServiceClient();
  const taskLabel = input.taskType === 'assembly' ? 'assembly' : input.taskType;
  const subject = `Task assigned: ${taskLabel}`;
  const body = [
    `You were assigned ${taskLabel} for serial ${input.serialNumber}.`,
    input.productName ? `Product: ${input.productName}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  await notifyUser(adminClient, {
    userId: input.assignedTo,
    eventType: 'task_assigned',
    subject,
    body,
    url: '/tasks',
  });
}

// Re-export for edge functions that import from this path
export { checkLowStockAndNotify, createServiceClient, notifyRoleUsers, notifyUser } from './notify.ts';
