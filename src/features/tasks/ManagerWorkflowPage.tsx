import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ManagerLayout } from '@/app/ManagerLayout';
import { DenseTable, DenseTableCell, DenseTableRow } from '@/features/products/components/DenseTable';
import {
  assignPurchaseRequest,
  assignSerialStage,
  friendlyTaskError,
  listAssignableEmployees,
  listEmployeeStatuses,
  listOpenAssignments,
  listReadyPurchaseRequests,
  subscribeToWorkflowChanges,
} from './api';
import type { TaskType } from '@/types/database';
import type { EmployeeStatusItem, ReadyRequestItem, SerialAssignmentWithContext } from './types';

type EmployeeOption = { id: string; email: string };

function nextTaskTypeForStage(stage: string | null): TaskType | null {
  if (stage === 'assembly_complete') return 'qc';
  if (stage === 'rework') return 'assembly';
  if (stage === 'qc_passed') return 'packing';
  if (stage === 'packed') return 'delivery';
  if (stage === 'delivered') return 'installation';
  return null;
}

function labelForTask(taskType: TaskType) {
  return taskType.toUpperCase();
}

export function ManagerWorkflowPage() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [statuses, setStatuses] = useState<EmployeeStatusItem[]>([]);
  const [readyRequests, setReadyRequests] = useState<ReadyRequestItem[]>([]);
  const [assignments, setAssignments] = useState<SerialAssignmentWithContext[]>([]);
  const [requestSelections, setRequestSelections] = useState<Record<string, string>>({});
  const [stageSelections, setStageSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const idleEmployees = useMemo(
    () => statuses.filter((status) => !status.activeAssignment),
    [statuses],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [employeeRows, statusRows, requestRows, assignmentRows] = await Promise.all([
        listAssignableEmployees(),
        listEmployeeStatuses(),
        listReadyPurchaseRequests(),
        listOpenAssignments(),
      ]);

      setEmployees(employeeRows.map((row) => ({ id: row.id, email: row.email })));
      setStatuses(statusRows);
      setReadyRequests(requestRows);
      setAssignments(assignmentRows);
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to load manager workflow'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const channel = subscribeToWorkflowChanges(() => {
      void load();
    });
    return () => {
      void channel.unsubscribe();
    };
  }, []);

  async function handleAssignRequest(requestId: string) {
    const assignedTo = requestSelections[requestId];
    if (!assignedTo) {
      setError('Select an employee before assigning the request.');
      return;
    }

    setSubmitting(requestId);
    setError(null);
    try {
      await assignPurchaseRequest(requestId, assignedTo);
      await load();
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to assign purchase request'));
    } finally {
      setSubmitting(null);
    }
  }

  async function handleAssignStage(serialId: string, taskType: TaskType) {
    const assignedTo = stageSelections[serialId];
    if (!assignedTo) {
      setError('Select an employee before assigning the next stage.');
      return;
    }

    setSubmitting(serialId);
    setError(null);
    try {
      await assignSerialStage(serialId, taskType, assignedTo);
      await load();
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to assign next stage'));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <ManagerLayout title="Manager Dashboard">
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <DenseTable headers={['Employee', 'Status', 'Current task', 'Serial']}>
            {statuses.map((status) => (
              <DenseTableRow key={status.id}>
                <DenseTableCell>{status.email}</DenseTableCell>
                <DenseTableCell>{status.activeAssignment ? 'On task' : 'Idle'}</DenseTableCell>
                <DenseTableCell>
                  {status.activeAssignment ? labelForTask(status.activeAssignment.task_type as TaskType) : '-'}
                </DenseTableCell>
                <DenseTableCell>{status.activeAssignment?.serials?.serial_number ?? '-'}</DenseTableCell>
              </DenseTableRow>
            ))}
          </DenseTable>

          <div className="cortex-module p-6">
            <h2 className="font-headline text-headline-md text-on-surface">Live summary</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded border border-border bg-surface p-4">
                <p className="cortex-label">Idle employees</p>
                <p className="mt-2 font-mono text-headline-md text-primary">{idleEmployees.length}</p>
              </div>
              <div className="rounded border border-border bg-surface p-4">
                <p className="cortex-label">Open assignments</p>
                <p className="mt-2 font-mono text-headline-md text-primary">{assignments.length}</p>
              </div>
              <div className="rounded border border-border bg-surface p-4">
                <p className="cortex-label">Ready PRs</p>
                <p className="mt-2 font-mono text-headline-md text-primary">{readyRequests.length}</p>
              </div>
              <div className="rounded border border-border bg-surface p-4">
                <p className="cortex-label">Procurement</p>
                <Link to="/procurement" className="mt-2 inline-block text-primary-container hover:underline">
                  Open workspace
                </Link>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-body-sm text-on-surface-variant">Loading live workflow…</p>
        ) : (
          <>
            <DenseTable headers={['Ready order', 'Qty', 'Priority', 'Assign to', 'Action']}>
              {readyRequests.map((request) => (
                <DenseTableRow key={request.id}>
                  <DenseTableCell>{request.products?.name ?? 'Unknown product'}</DenseTableCell>
                  <DenseTableCell>{request.qty}</DenseTableCell>
                  <DenseTableCell>{request.priority}</DenseTableCell>
                  <DenseTableCell>
                    <select
                      className="cortex-input h-9"
                      value={requestSelections[request.id] ?? ''}
                      onChange={(e) =>
                        setRequestSelections((current) => ({ ...current, [request.id]: e.target.value }))
                      }
                    >
                      <option value="">Select employee</option>
                      {idleEmployees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.email}
                        </option>
                      ))}
                    </select>
                  </DenseTableCell>
                  <DenseTableCell>
                    <button
                      type="button"
                      disabled={submitting === request.id}
                      onClick={() => void handleAssignRequest(request.id)}
                      className="text-primary-container hover:underline"
                    >
                      {submitting === request.id ? 'Assigning…' : 'Assign assembly'}
                    </button>
                  </DenseTableCell>
                </DenseTableRow>
              ))}
              {readyRequests.length === 0 && (
                <DenseTableRow>
                  <DenseTableCell className="py-6 text-on-surface-variant">No ready purchase requests.</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                  <DenseTableCell>{null}</DenseTableCell>
                </DenseTableRow>
              )}
            </DenseTable>

            <DenseTable headers={['Serial', 'Product', 'Current stage', 'Assigned', 'Next stage', 'Action']}>
              {assignments.map((assignment) => {
                const serial = assignment.serials;
                const nextTaskType = nextTaskTypeForStage(serial?.current_stage ?? null);

                return (
                  <DenseTableRow key={assignment.id}>
                    <DenseTableCell>{serial?.serial_number ?? 'Unknown serial'}</DenseTableCell>
                    <DenseTableCell>{serial?.purchase_requests?.products?.name ?? 'Unknown product'}</DenseTableCell>
                    <DenseTableCell>{serial?.current_stage ?? assignment.task_type}</DenseTableCell>
                    <DenseTableCell>{assignment.assigned_user?.email ?? '-'}</DenseTableCell>
                    <DenseTableCell>
                      {nextTaskType ? (
                        <select
                          className="cortex-input h-9"
                          value={stageSelections[serial?.id ?? ''] ?? ''}
                          onChange={(e) =>
                            setStageSelections((current) => ({
                              ...current,
                              [serial?.id ?? '']: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select employee</option>
                          {employees
                            .filter((employee) =>
                              nextTaskType === 'qc'
                                ? employee.id !== serial?.assigned_to
                                : true,
                            )
                            .map((employee) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.email}
                              </option>
                            ))}
                        </select>
                      ) : (
                        '-'
                      )}
                    </DenseTableCell>
                    <DenseTableCell>
                      {nextTaskType ? (
                        <button
                          type="button"
                          disabled={!serial || submitting === serial.id}
                          onClick={() => serial && void handleAssignStage(serial.id, nextTaskType)}
                          className="text-primary-container hover:underline"
                        >
                          {submitting === serial?.id ? `Assigning ${nextTaskType}…` : `Assign ${nextTaskType}`}
                        </button>
                      ) : (
                        <span className="text-on-surface-variant">In progress</span>
                      )}
                    </DenseTableCell>
                  </DenseTableRow>
                );
              })}
            </DenseTable>
          </>
        )}
      </div>
    </ManagerLayout>
  );
}
