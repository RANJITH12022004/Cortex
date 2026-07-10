import { z } from 'zod';

export const FORM_FIELD_TYPES = [
  'short_text',
  'paragraph',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'linear_scale',
  'date',
  'time',
  'file_upload',
  'pass_fail',
  'section_header',
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FORM_TYPE_LABELS: Record<FormFieldType, string> = {
  short_text: 'Short answer',
  paragraph: 'Paragraph',
  multiple_choice: 'Multiple choice',
  checkboxes: 'Checkboxes',
  dropdown: 'Dropdown',
  linear_scale: 'Linear scale',
  date: 'Date',
  time: 'Time',
  file_upload: 'File upload',
  pass_fail: 'Pass / Fail',
  section_header: 'Section header',
};

export const formFieldSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(FORM_FIELD_TYPES),
  label: z.string().min(1, 'Question title is required'),
  description: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1)).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const formDefinitionSchema = z.object({
  title: z.string().min(1, 'Form title is required'),
  description: z.string().optional(),
  fields: z.array(formFieldSchema),
});

export type FormField = z.infer<typeof formFieldSchema>;
export type FormDefinition = z.infer<typeof formDefinitionSchema>;

export type ProductFormKind = 'assembly' | 'qc' | 'installation';

export const PRODUCT_FORM_KIND_LABELS: Record<ProductFormKind, string> = {
  assembly: 'Assembly form',
  qc: 'QC form',
  installation: 'Installation form',
};

export function createEmptyField(type: FormFieldType): FormField {
  const base = {
    id: crypto.randomUUID(),
    type,
    label: type === 'section_header' ? 'Section title' : 'Untitled question',
    required: type !== 'section_header',
  };
  if (type === 'multiple_choice' || type === 'checkboxes' || type === 'dropdown') {
    return { ...base, options: ['Option 1'] };
  }
  if (type === 'linear_scale') {
    return { ...base, min: 1, max: 5 };
  }
  return base;
}

export function defaultFormDefinition(kind: ProductFormKind, productName: string): FormDefinition {
  const titles: Record<ProductFormKind, string> = {
    assembly: `${productName} — Assembly`,
    qc: `${productName} — Quality check`,
    installation: `${productName} — Installation`,
  };
  return {
    title: titles[kind],
    description: '',
    fields: [],
  };
}

/** Maps rich form fields to legacy assembly_templates step names. */
export function extractAssemblySteps(definition: FormDefinition): string[] {
  const hasSections = definition.fields.some((f) => f.type === 'section_header');
  if (hasSections) {
    return definition.fields
      .filter((f) => f.type === 'section_header')
      .map((f) => f.label.trim())
      .filter(Boolean);
  }
  return definition.fields
    .filter((f) => f.type !== 'section_header')
    .map((f) => f.label.trim())
    .filter(Boolean);
}

/** Maps rich form fields to legacy qc_templates checkpoint names. */
export function extractQcCheckpoints(definition: FormDefinition): string[] {
  return definition.fields
    .filter((f) => f.type !== 'section_header')
    .map((f) => f.label.trim())
    .filter(Boolean);
}
