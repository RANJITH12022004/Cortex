import { useState } from 'react';
import {
  FORM_FIELD_TYPES,
  FORM_TYPE_LABELS,
  createEmptyField,
  type FormDefinition,
  type FormField,
  type FormFieldType,
} from '../formSchemas';

type FormBuilderProps = {
  definition: FormDefinition;
  onChange: (definition: FormDefinition) => void;
  allowedFieldTypes?: FormFieldType[];
};

const DEFAULT_QC_TYPES: FormFieldType[] = [
  'section_header',
  'pass_fail',
  'short_text',
  'paragraph',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'file_upload',
  'linear_scale',
  'date',
  'time',
];

const DEFAULT_ASSEMBLY_TYPES: FormFieldType[] = [
  'section_header',
  'short_text',
  'paragraph',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'file_upload',
  'date',
  'time',
];

function FieldPreview({ field }: { field: FormField }) {
  switch (field.type) {
    case 'short_text':
      return <div className="mt-3 h-9 rounded border border-dashed border-border bg-surface-container-lowest" />;
    case 'paragraph':
      return <div className="mt-3 h-20 rounded border border-dashed border-border bg-surface-container-lowest" />;
    case 'multiple_choice':
    case 'dropdown':
      return (
        <div className="mt-3 space-y-2">
          {(field.options ?? ['Option 1']).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <span className="inline-block h-4 w-4 rounded-full border border-border" />
              {opt}
            </label>
          ))}
        </div>
      );
    case 'checkboxes':
      return (
        <div className="mt-3 space-y-2">
          {(field.options ?? ['Option 1']).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <span className="inline-block h-4 w-4 rounded border border-border" />
              {opt}
            </label>
          ))}
        </div>
      );
    case 'linear_scale':
      return (
        <div className="mt-3 flex items-center gap-2 text-body-sm text-on-surface-variant">
          <span>{field.min ?? 1}</span>
          {Array.from({ length: (field.max ?? 5) - (field.min ?? 1) + 1 }).map((_, i) => (
            <span key={i} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border">
              {(field.min ?? 1) + i}
            </span>
          ))}
          <span>{field.max ?? 5}</span>
        </div>
      );
    case 'pass_fail':
      return (
        <div className="mt-3 flex gap-4 text-body-sm text-on-surface-variant">
          <label className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-full border border-border" /> Pass
          </label>
          <label className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-full border border-border" /> Fail
          </label>
        </div>
      );
    case 'file_upload':
      return (
        <div className="mt-3 rounded border border-dashed border-border bg-surface-container-lowest px-4 py-6 text-center text-body-sm text-on-surface-variant">
          Upload file or photo
        </div>
      );
    case 'date':
    case 'time':
      return <div className="mt-3 h-9 w-48 rounded border border-dashed border-border bg-surface-container-lowest" />;
    case 'section_header':
      return null;
    default:
      return null;
  }
}

function FieldEditor({
  field,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  field: FormField;
  index: number;
  total: number;
  onUpdate: (field: FormField) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const isSection = field.type === 'section_header';

  return (
    <article
      className={`rounded-lg border bg-surface shadow-sm transition-shadow hover:shadow-md ${
        isSection ? 'border-primary-container/40 border-l-4' : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex shrink-0 flex-col gap-1 pt-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="rounded px-1 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="rounded px-1 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
            aria-label="Move down"
          >
            ↓
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={field.label}
              onChange={(e) => onUpdate({ ...field, label: e.target.value })}
              placeholder={isSection ? 'Section title' : 'Question'}
              className={`w-full border-0 border-b border-transparent bg-transparent px-0 py-1 focus:border-primary-container focus:outline-none ${
                isSection ? 'font-headline text-headline-sm' : 'text-body-md font-medium'
              }`}
            />
          </div>
          {!isSection && (
            <input
              type="text"
              value={field.description ?? ''}
              onChange={(e) => onUpdate({ ...field, description: e.target.value || undefined })}
              placeholder="Description (optional)"
              className="mt-1 w-full border-0 bg-transparent text-body-sm text-on-surface-variant focus:outline-none"
            />
          )}
          <FieldPreview field={field} />
          {(field.type === 'multiple_choice' ||
            field.type === 'checkboxes' ||
            field.type === 'dropdown') && (
            <div className="mt-4 space-y-2">
              {(field.options ?? []).map((opt, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2">
                  <span className="text-on-surface-variant">
                    {field.type === 'checkboxes' ? '☐' : '○'}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const options = [...(field.options ?? [])];
                      options[optIndex] = e.target.value;
                      onUpdate({ ...field, options });
                    }}
                    className="cortex-input flex-1 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const options = (field.options ?? []).filter((_, i) => i !== optIndex);
                      onUpdate({ ...field, options: options.length ? options : ['Option 1'] });
                    }}
                    className="text-error hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    ...field,
                    options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`],
                  })
                }
                className="text-body-sm text-primary-container hover:underline"
              >
                Add option
              </button>
            </div>
          )}
          {field.type === 'linear_scale' && (
            <div className="mt-4 flex gap-4">
              <label className="text-body-sm">
                Min
                <input
                  type="number"
                  value={field.min ?? 1}
                  onChange={(e) => onUpdate({ ...field, min: Number(e.target.value) })}
                  className="cortex-input ml-2 w-16"
                />
              </label>
              <label className="text-body-sm">
                Max
                <input
                  type="number"
                  value={field.max ?? 5}
                  onChange={(e) => onUpdate({ ...field, max: Number(e.target.value) })}
                  className="cortex-input ml-2 w-16"
                />
              </label>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <select
            value={field.type}
            onChange={(e) => {
              const nextType = e.target.value as FormFieldType;
              const fresh = createEmptyField(nextType);
              onUpdate({ ...fresh, id: field.id, label: field.label, description: field.description });
            }}
            className="cortex-input max-w-[160px] py-1 text-body-sm"
          >
            {FORM_FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {FORM_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          {!isSection && (
            <label className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={field.required ?? false}
                onChange={(e) => onUpdate({ ...field, required: e.target.checked })}
              />
              Required
            </label>
          )}
          <button type="button" onClick={onRemove} className="text-body-sm text-error hover:underline">
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export function FormBuilder({
  definition,
  onChange,
  allowedFieldTypes = DEFAULT_ASSEMBLY_TYPES,
}: FormBuilderProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  function updateField(index: number, field: FormField) {
    const fields = definition.fields.map((f, i) => (i === index ? field : f));
    onChange({ ...definition, fields });
  }

  function removeField(index: number) {
    onChange({ ...definition, fields: definition.fields.filter((_, i) => i !== index) });
  }

  function moveField(index: number, direction: -1 | 1) {
    const next = [...definition.fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...definition, fields: next });
  }

  function addField(type: FormFieldType) {
    onChange({ ...definition, fields: [...definition.fields, createEmptyField(type)] });
    setAddMenuOpen(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="overflow-hidden rounded-lg border border-primary-container/30 bg-surface shadow-sm">
        <div className="h-2 bg-primary-container" />
        <div className="space-y-3 p-6">
          <input
            type="text"
            value={definition.title}
            onChange={(e) => onChange({ ...definition, title: e.target.value })}
            placeholder="Form title"
            className="w-full border-0 bg-transparent font-headline text-headline-md focus:outline-none"
          />
          <input
            type="text"
            value={definition.description ?? ''}
            onChange={(e) => onChange({ ...definition, description: e.target.value || undefined })}
            placeholder="Form description"
            className="w-full border-0 bg-transparent text-body-md text-on-surface-variant focus:outline-none"
          />
        </div>
      </div>

      {definition.fields.map((field, index) => (
        <FieldEditor
          key={field.id}
          field={field}
          index={index}
          total={definition.fields.length}
          onUpdate={(updated) => updateField(index, { ...updated, id: field.id })}
          onRemove={() => removeField(index)}
          onMove={(dir) => moveField(index, dir)}
        />
      ))}

      <div className="relative flex justify-center pb-8">
        <button
          type="button"
          onClick={() => setAddMenuOpen((v) => !v)}
          className="cortex-btn-primary w-auto px-6"
        >
          + Add question
        </button>
        {addMenuOpen && (
          <div className="absolute top-full z-10 mt-2 w-64 rounded-lg border border-border bg-surface py-2 shadow-lg">
            {allowedFieldTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addField(type)}
                className="block w-full px-4 py-2 text-left text-body-sm hover:bg-surface-container-high"
              >
                {FORM_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const FORM_BUILDER_QC_TYPES = DEFAULT_QC_TYPES;
export const FORM_BUILDER_ASSEMBLY_TYPES = DEFAULT_ASSEMBLY_TYPES;
