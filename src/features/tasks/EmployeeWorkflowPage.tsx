import { FormEvent, useEffect, useMemo, useState } from 'react';
import { WorkspaceLayout } from '@/app/WorkspaceLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { DenseTable, DenseTableCell, DenseTableRow } from '@/features/products/components/DenseTable';
import {
  addRemark,
  completeAssignment,
  completePacking,
  friendlyTaskError,
  getActiveTaskBundle,
  listMyAssignments,
  saveDelivery,
  saveInstallation,
  submitQcResults,
  subscribeToWorkflowChanges,
  updateSerialStep,
  uploadAttachment,
} from './api';
import { fileToBase64 } from './fileUtils';
import { confirmMaterialHandover, listEmployeeHandovers, reportDamage as reportProcurementDamage } from '@/features/procurement/api';
import {
  damageReportSchema,
} from '@/features/procurement/schemas';
import { deliverySchema, installationSchema, qcSubmissionSchema } from './schemas';
import type { TaskType } from '@/types/database';
import type { ActiveTaskBundle, SerialAssignmentWithContext } from './types';
import { taskTypeSchema } from './schemas';
import { PushEnableBanner } from '@/features/notifications/InstallPrompt';

function getNextStageAfterTask(taskType: TaskType) {
  switch (taskType) {
    case 'assembly':
      return 'assembly_complete';
    case 'packing':
      return 'packed';
    case 'delivery':
      return 'delivered';
    case 'installation':
      return 'installed';
    default:
      return taskType;
  }
}

export function EmployeeWorkflowPage() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<SerialAssignmentWithContext[]>([]);
  const [selectedSerialId, setSelectedSerialId] = useState('');
  const [bundle, setBundle] = useState<ActiveTaskBundle | null>(null);
  const [qcResults, setQcResults] = useState<Record<string, { result: 'pass' | 'fail'; note: string }>>({});
  const [damageQty, setDamageQty] = useState('1');
  const [damageReason, setDamageReason] = useState('');
  const [remarkText, setRemarkText] = useState('');
  const [deliveryPartner, setDeliveryPartner] = useState('');
  const [deliveryDocsLink, setDeliveryDocsLink] = useState('');
  const [installationDocsLink, setInstallationDocsLink] = useState('');
  const [stageRemark, setStageRemark] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handovers, setHandovers] = useState<Awaited<ReturnType<typeof listEmployeeHandovers>>>([]);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.serial_id === selectedSerialId) ?? null,
    [assignments, selectedSerialId],
  );

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const nextAssignments = await listMyAssignments(profile.id);
      const nextHandovers = await listEmployeeHandovers();
      setAssignments(nextAssignments);
      setHandovers(nextHandovers);
      const nextSerialId = selectedSerialId || nextAssignments[0]?.serial_id || '';
      setSelectedSerialId(nextSerialId);

      if (nextSerialId) {
        const nextBundle = await getActiveTaskBundle(nextSerialId);
        setBundle(nextBundle);
        setQcResults(
          Object.fromEntries(
            nextBundle.qcTemplates.map((template) => [
              template.checkpoint_name,
              { result: 'pass', note: '' },
            ]),
          ),
        );
      } else {
        setBundle(null);
      }
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to load tasks'));
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
  }, [profile?.id]);

  useEffect(() => {
    if (!selectedSerialId) return;
    void (async () => {
      try {
        setBundle(await getActiveTaskBundle(selectedSerialId));
      } catch (err) {
        setError(friendlyTaskError(err, 'Failed to load selected task'));
      }
    })();
  }, [selectedSerialId]);

  async function handleUploadAttachment(stepName: string, taskType: TaskType, checkpointName?: string | null) {
    if (!bundle) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setSaving(`upload-${stepName}`);
      setError(null);
      try {
        const contentBase64 = await fileToBase64(file);
        await uploadAttachment({
          serialId: bundle.serial.id,
          stepName,
          taskType,
          checkpointName,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          contentBase64,
        });
        setBundle(await getActiveTaskBundle(bundle.serial.id));
      } catch (err) {
        setError(friendlyTaskError(err, 'Failed to upload attachment'));
      } finally {
        setSaving(null);
      }
    };
    input.click();
  }

  async function handleConfirmHandover(handoverId: string) {
    if (!profile || !bundle) return;
    setSaving(handoverId);
    setError(null);
    try {
      await confirmMaterialHandover(handoverId, profile.id);
      setBundle(await getActiveTaskBundle(bundle.serial.id));
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to confirm handover'));
    } finally {
      setSaving(null);
    }
  }

  async function handleAssemblyStep(stepId: string, status: 'in_progress' | 'completed') {
    if (!profile || !bundle) return;
    setSaving(stepId);
    setError(null);
    try {
      await updateSerialStep(stepId, status, profile.id);
      setBundle(await getActiveTaskBundle(bundle.serial.id));
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to update step'));
    } finally {
      setSaving(null);
    }
  }

  async function handleCompleteCurrentTask() {
    if (!profile || !bundle) return;
    setSaving('complete-task');
    setError(null);
    try {
      if (bundle.assignment.task_type === 'assembly') {
        await completeAssignment(bundle.serial.id, 'assembly', profile.id, getNextStageAfterTask('assembly'));
      } else if (bundle.assignment.task_type === 'packing') {
        await completePacking(bundle.serial.id, profile.id);
      }
      await load();
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to complete task'));
    } finally {
      setSaving(null);
    }
  }

  async function handleSubmitQc(event: FormEvent) {
    event.preventDefault();
    if (!profile || !bundle) return;
    const parsed = qcSubmissionSchema.safeParse({
      serial_id: bundle.serial.id,
      checkpoints: bundle.qcTemplates.map((template) => ({
        checkpoint_name: template.checkpoint_name,
        result: qcResults[template.checkpoint_name]?.result ?? 'pass',
        note: qcResults[template.checkpoint_name]?.note ?? '',
      })),
    });

    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid QC submission');
      return;
    }

    setSaving('qc');
    setError(null);
    try {
      await submitQcResults(parsed.data, profile.id);
      await load();
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to submit QC'));
    } finally {
      setSaving(null);
    }
  }

  async function handleDamageReport(event: FormEvent) {
    event.preventDefault();
    if (!profile || !bundle) return;
    const firstHandover =
      handovers.find((handover) => handover.serial_id === bundle.serial.id && handover.part_id)?.id ?? null;
    const parsed = damageReportSchema.safeParse({
      serial_id: bundle.serial.id,
      part_id: handovers.find((handover) => handover.serial_id === bundle.serial.id)?.part_id ?? '',
      qty: damageQty,
      original_handover_id: firstHandover,
      reason: damageReason,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid damage report');
      return;
    }
    setSaving('damage');
    setError(null);
    try {
      await reportProcurementDamage({ ...parsed.data, reported_by: profile.id });
      setDamageQty('1');
      setDamageReason('');
      await load();
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to submit damage report'));
    } finally {
      setSaving(null);
    }
  }

  async function handleAddRemark(stepName: string) {
    if (!profile || !bundle || !remarkText.trim()) return;
    setSaving('remark');
    setError(null);
    try {
      await addRemark(bundle.serial.id, stepName, profile.id, remarkText.trim());
      setRemarkText('');
      setBundle(await getActiveTaskBundle(bundle.serial.id));
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to add remark'));
    } finally {
      setSaving(null);
    }
  }

  async function handleDelivery(event: FormEvent) {
    event.preventDefault();
    if (!profile || !bundle) return;
    const parsed = deliverySchema.safeParse({
      serial_id: bundle.serial.id,
      delivery_partner: deliveryPartner,
      delivery_docs_link: deliveryDocsLink,
      remark: stageRemark,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid delivery form');
      return;
    }
    setSaving('delivery');
    setError(null);
    try {
      await saveDelivery(parsed.data, profile.id);
      setDeliveryPartner('');
      setDeliveryDocsLink('');
      setStageRemark('');
      await load();
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to save delivery'));
    } finally {
      setSaving(null);
    }
  }

  async function handleInstallation(event: FormEvent) {
    event.preventDefault();
    if (!profile || !bundle) return;
    const parsed = installationSchema.safeParse({
      serial_id: bundle.serial.id,
      installation_docs_link: installationDocsLink,
      remark: stageRemark,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid installation form');
      return;
    }
    setSaving('installation');
    setError(null);
    try {
      await saveInstallation(parsed.data, profile.id);
      setInstallationDocsLink('');
      setStageRemark('');
      await load();
    } catch (err) {
      setError(friendlyTaskError(err, 'Failed to save installation'));
    } finally {
      setSaving(null);
    }
  }

  const pageTitle = profile?.role === 'admin' ? 'Employee tasks' : 'My Tasks';

  return (
    <WorkspaceLayout title={pageTitle}>
      <div className="space-y-6">
        <PushEnableBanner />
        {error && (
          <p className="rounded border border-error bg-error-container px-3 py-2 text-body-sm text-on-error-container">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-body-sm text-on-surface-variant">Loading active tasks…</p>
        ) : (
          <>
            <div className="cortex-module p-6">
              <label className="cortex-label mb-2 block">Active assignment</label>
              <select
                className="cortex-input max-w-xl"
                value={selectedSerialId}
                onChange={(e) => setSelectedSerialId(e.target.value)}
              >
                {assignments.length === 0 && <option value="">No active assignments</option>}
                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.serial_id}>
                    {(assignment.serials?.serial_number ?? 'Unknown serial') +
                      ' - ' +
                      taskTypeSchema.parse(assignment.task_type).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {bundle && selectedAssignment && (
              <div className="space-y-6">
                <div className="cortex-module p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="cortex-label">Serial</p>
                      <h2 className="font-headline text-headline-md text-on-surface">
                        {bundle.serial.serial_number}
                      </h2>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        {bundle.assignment.serials?.purchase_requests?.products?.name ?? 'Unknown product'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="cortex-label">Current task</p>
                      <p className="font-mono text-data-mono text-primary">
                        {selectedAssignment.task_type.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedAssignment.task_type === 'assembly' && (
                  <>
                    <DenseTable headers={['Step', 'Status', 'Attachment', 'Action']}>
                      {bundle.serialSteps.map((step) => (
                        <DenseTableRow key={step.id}>
                          <DenseTableCell>{step.step_name}</DenseTableCell>
                          <DenseTableCell>{step.status}</DenseTableCell>
                          <DenseTableCell>
                            <div className="flex flex-wrap gap-2">
                              {step.attachments.map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.drive_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary-container hover:underline"
                                >
                                  File
                                </a>
                              ))}
                              <button
                                type="button"
                                className="text-on-surface-variant hover:text-primary-container"
                                onClick={() => void handleUploadAttachment(step.step_name, 'assembly')}
                              >
                                Upload
                              </button>
                            </div>
                          </DenseTableCell>
                          <DenseTableCell>
                            <div className="flex gap-3">
                              {step.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => void handleAssemblyStep(step.id, 'in_progress')}
                                  className="text-primary-container hover:underline"
                                >
                                  Start
                                </button>
                              )}
                              {step.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => void handleAssemblyStep(step.id, 'completed')}
                                  className="text-primary-container hover:underline"
                                >
                                  Complete
                                </button>
                              )}
                            </div>
                          </DenseTableCell>
                        </DenseTableRow>
                      ))}
                    </DenseTable>

                    <button
                      type="button"
                      disabled={bundle.serialSteps.some((step) => step.status !== 'completed') || saving === 'complete-task'}
                      className="cortex-btn-primary"
                      onClick={() => void handleCompleteCurrentTask()}
                    >
                      {saving === 'complete-task' ? 'Submitting…' : 'Mark assembly ready for QC'}
                    </button>
                  </>
                )}

                {selectedAssignment.task_type === 'qc' && (
                  <form onSubmit={(e) => void handleSubmitQc(e)} className="cortex-module p-6">
                    <h3 className="font-headline text-headline-md text-on-surface">QC checklist</h3>
                    <div className="mt-4 space-y-4">
                      {bundle.qcTemplates.map((checkpoint) => (
                        <div key={checkpoint.checkpoint_name} className="rounded border border-border bg-surface p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-semibold">{checkpoint.checkpoint_name}</p>
                            <div className="flex gap-3">
                              <label className="text-body-sm">
                                <input
                                  type="radio"
                                  checked={(qcResults[checkpoint.checkpoint_name]?.result ?? 'pass') === 'pass'}
                                  onChange={() =>
                                    setQcResults((current) => ({
                                      ...current,
                                      [checkpoint.checkpoint_name]: {
                                        ...(current[checkpoint.checkpoint_name] ?? { note: '' }),
                                        result: 'pass',
                                      },
                                    }))
                                  }
                                />{' '}
                                Pass
                              </label>
                              <label className="text-body-sm">
                                <input
                                  type="radio"
                                  checked={(qcResults[checkpoint.checkpoint_name]?.result ?? 'pass') === 'fail'}
                                  onChange={() =>
                                    setQcResults((current) => ({
                                      ...current,
                                      [checkpoint.checkpoint_name]: {
                                        ...(current[checkpoint.checkpoint_name] ?? { note: '' }),
                                        result: 'fail',
                                      },
                                    }))
                                  }
                                />{' '}
                                Fail
                              </label>
                            </div>
                          </div>
                          <textarea
                            className="cortex-input mt-3 min-h-[90px] py-2"
                            placeholder="Optional note"
                            value={qcResults[checkpoint.checkpoint_name]?.note ?? ''}
                            onChange={(e) =>
                              setQcResults((current) => ({
                                ...current,
                                [checkpoint.checkpoint_name]: {
                                  result: current[checkpoint.checkpoint_name]?.result ?? 'pass',
                                  note: e.target.value,
                                },
                              }))
                            }
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            {bundle.attachments
                              .filter(
                                (attachment) =>
                                  attachment.task_type === 'qc' &&
                                  attachment.checkpoint_name === checkpoint.checkpoint_name,
                              )
                              .map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.drive_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary-container hover:underline"
                                >
                                  Attachment
                                </a>
                              ))}
                            <button
                              type="button"
                              className="text-on-surface-variant hover:text-primary-container"
                              onClick={() =>
                                void handleUploadAttachment(
                                  checkpoint.checkpoint_name,
                                  'qc',
                                  checkpoint.checkpoint_name,
                                )
                              }
                            >
                              Upload evidence
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="submit" className="cortex-btn-primary mt-4" disabled={saving === 'qc'}>
                      {saving === 'qc' ? 'Saving…' : 'Submit QC'}
                    </button>
                  </form>
                )}

                {selectedAssignment.task_type === 'packing' && (
                  <div className="cortex-module p-6">
                    <h3 className="font-headline text-headline-md text-on-surface">Packing</h3>
                    <div className="mt-4 space-y-4">
                      <textarea
                        className="cortex-input min-h-[100px] py-2"
                        placeholder="Packing remark"
                        value={remarkText}
                        onChange={(e) => setRemarkText(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="text-primary-container hover:underline"
                          onClick={() => void handleUploadAttachment('packing', 'packing')}
                        >
                          Upload packing file
                        </button>
                        <button
                          type="button"
                          className="cortex-btn-primary"
                          disabled={saving === 'complete-task'}
                          onClick={async () => {
                            if (remarkText.trim() && profile) {
                              await handleAddRemark('packing');
                            }
                            await handleCompleteCurrentTask();
                          }}
                        >
                          {saving === 'complete-task' ? 'Saving…' : 'Complete packing'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAssignment.task_type === 'delivery' && (
                  <form onSubmit={(e) => void handleDelivery(e)} className="cortex-module p-6">
                    <h3 className="font-headline text-headline-md text-on-surface">Delivery</h3>
                    <div className="mt-4 space-y-4">
                      <input
                        className="cortex-input"
                        placeholder="Delivery partner"
                        value={deliveryPartner}
                        onChange={(e) => setDeliveryPartner(e.target.value)}
                      />
                      <input
                        className="cortex-input"
                        placeholder="Docs link"
                        value={deliveryDocsLink}
                        onChange={(e) => setDeliveryDocsLink(e.target.value)}
                      />
                      <textarea
                        className="cortex-input min-h-[90px] py-2"
                        placeholder="Delivery remark"
                        value={stageRemark}
                        onChange={(e) => setStageRemark(e.target.value)}
                      />
                      <button type="submit" className="cortex-btn-primary" disabled={saving === 'delivery'}>
                        {saving === 'delivery' ? 'Saving…' : 'Complete delivery'}
                      </button>
                    </div>
                  </form>
                )}

                {selectedAssignment.task_type === 'installation' && (
                  <form onSubmit={(e) => void handleInstallation(e)} className="cortex-module p-6">
                    <h3 className="font-headline text-headline-md text-on-surface">Installation</h3>
                    <div className="mt-4 space-y-4">
                      <input
                        className="cortex-input"
                        placeholder="Installation docs link"
                        value={installationDocsLink}
                        onChange={(e) => setInstallationDocsLink(e.target.value)}
                      />
                      <textarea
                        className="cortex-input min-h-[90px] py-2"
                        placeholder="Installation remark"
                        value={stageRemark}
                        onChange={(e) => setStageRemark(e.target.value)}
                      />
                      <button type="submit" className="cortex-btn-primary" disabled={saving === 'installation'}>
                        {saving === 'installation' ? 'Saving…' : 'Complete installation'}
                      </button>
                    </div>
                  </form>
                )}

                <DenseTable headers={['Issued part', 'Qty', 'Receipt', 'Action']}>
                  {handovers
                    .filter((handover) => handover.serial_id === bundle.serial.id)
                    .map((handover) => (
                      <DenseTableRow key={handover.id}>
                        <DenseTableCell>{handover.parts?.name ?? 'Unknown part'}</DenseTableCell>
                        <DenseTableCell>{handover.qty}</DenseTableCell>
                        <DenseTableCell>{handover.received_at ? 'Confirmed' : 'Pending'}</DenseTableCell>
                        <DenseTableCell>
                          {!handover.received_at && (
                            <button
                              type="button"
                              className="text-primary-container hover:underline"
                              onClick={() => void handleConfirmHandover(handover.id)}
                            >
                              Confirm receipt
                            </button>
                          )}
                        </DenseTableCell>
                      </DenseTableRow>
                    ))}
                </DenseTable>

                <form onSubmit={(e) => void handleDamageReport(e)} className="cortex-module max-w-xl p-6">
                  <h3 className="font-headline text-headline-md text-on-surface">Report damaged part</h3>
                  <div className="mt-4 space-y-4">
                    <input
                      className="cortex-input"
                      type="number"
                      min="0"
                      step="0.001"
                      value={damageQty}
                      onChange={(e) => setDamageQty(e.target.value)}
                      placeholder="Quantity damaged"
                    />
                    <textarea
                      className="cortex-input min-h-[100px] py-2"
                      placeholder="Reason"
                      value={damageReason}
                      onChange={(e) => setDamageReason(e.target.value)}
                    />
                    <button type="submit" className="cortex-btn-primary" disabled={saving === 'damage'}>
                      {saving === 'damage' ? 'Submitting…' : 'Submit damage report'}
                    </button>
                  </div>
                </form>

                <DenseTable headers={['Stage', 'Remark']}>
                  {bundle.remarks.map((remark) => (
                    <DenseTableRow key={remark.id}>
                      <DenseTableCell>{remark.step_name}</DenseTableCell>
                      <DenseTableCell>{remark.text}</DenseTableCell>
                    </DenseTableRow>
                  ))}
                  {bundle.remarks.length === 0 && (
                    <DenseTableRow>
                      <DenseTableCell className="py-6 text-on-surface-variant">No remarks yet.</DenseTableCell>
                      <DenseTableCell>{null}</DenseTableCell>
                    </DenseTableRow>
                  )}
                </DenseTable>
              </div>
            )}
          </>
        )}
      </div>
    </WorkspaceLayout>
  );
}
