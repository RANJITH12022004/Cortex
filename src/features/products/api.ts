import { supabase } from '@/lib/supabase';
import type { BomOnlyFormValues, ProductSetupFormValues } from './schemas';
import {
  defaultFormDefinition,
  extractAssemblySteps,
  extractQcCheckpoints,
  formDefinitionSchema,
  type FormDefinition,
  type ProductFormKind,
} from './formSchemas';
import type { Product, ProductBundle, ProductFormRow, ProductHubSummary, ProductListItem } from './types';

export async function listProducts(includeArchived: boolean): Promise<ProductListItem[]> {
  let query = supabase.from('products').select('*, bom(count)').order('created_at', {
    ascending: false,
  });

  if (!includeArchived) {
    query = query.eq('archived', false);
  }

  const { data, error } = await query;
  if (error) throw error;

  type ProductRow = Product & { bom: { count: number }[] };
  return ((data ?? []) as ProductRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    created_by: row.created_by,
    archived: row.archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
    bom_count: row.bom?.[0]?.count ?? 0,
  }));
}

export async function getProductBundle(id: string): Promise<ProductBundle> {
  const [productRes, bomRes, assemblyRes, qcRes] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).single(),
    supabase
      .from('bom')
      .select('*, parts(id, name, mpn, description)')
      .eq('product_id', id)
      .order('id'),
    supabase
      .from('assembly_templates')
      .select('*')
      .eq('product_id', id)
      .order('step_order'),
    supabase.from('qc_templates').select('*').eq('product_id', id).order('checkpoint_order'),
  ]);

  if (productRes.error) throw productRes.error;
  if (bomRes.error) throw bomRes.error;
  if (assemblyRes.error) throw assemblyRes.error;
  if (qcRes.error) throw qcRes.error;

  return {
    product: productRes.data,
    bom: bomRes.data ?? [],
    assemblySteps: assemblyRes.data ?? [],
    qcCheckpoints: qcRes.data ?? [],
  };
}

export async function createProduct(input: {
  name: string;
  description?: string | null;
  created_by: string;
}): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: input.name,
      description: input.description ?? null,
      created_by: input.created_by,
      archived: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(
  id: string,
  input: { name?: string; description?: string | null; archived?: boolean },
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function syncProductSetup(
  productId: string,
  values: ProductSetupFormValues,
): Promise<ProductBundle> {
  const partIds = [...new Set(values.bom.map((r) => r.part_id))];
  if (partIds.length !== values.bom.length) {
    throw new Error('Each part can only appear once in the BOM.');
  }

  const { error: productError } = await supabase
    .from('products')
    .update({
      name: values.name,
      description: values.description ?? null,
    })
    .eq('id', productId);
  if (productError) throw productError;

  const { data: existingBom, error: bomFetchError } = await supabase
    .from('bom')
    .select('id, part_id')
    .eq('product_id', productId);
  if (bomFetchError) throw bomFetchError;

  const newPartIdSet = new Set(partIds);
  const toDelete = (existingBom ?? [])
    .filter((row) => !newPartIdSet.has(row.part_id))
    .map((row) => row.id);

  if (toDelete.length > 0) {
    const { error } = await supabase.from('bom').delete().in('id', toDelete);
    if (error) throw error;
  }

  for (const row of values.bom) {
    const { error } = await supabase.from('bom').upsert(
      {
        product_id: productId,
        part_id: row.part_id,
        qty_required: row.qty_required,
      },
      { onConflict: 'product_id,part_id' },
    );
    if (error) throw error;
  }

  const { error: deleteAssemblyError } = await supabase
    .from('assembly_templates')
    .delete()
    .eq('product_id', productId);
  if (deleteAssemblyError) throw deleteAssemblyError;

  if (values.assemblySteps.length > 0) {
    const { error } = await supabase.from('assembly_templates').insert(
      values.assemblySteps.map((step, index) => ({
        product_id: productId,
        step_order: index + 1,
        step_name: step.step_name,
      })),
    );
    if (error) throw error;
  }

  const { error: deleteQcError } = await supabase
    .from('qc_templates')
    .delete()
    .eq('product_id', productId);
  if (deleteQcError) throw deleteQcError;

  if (values.qcCheckpoints.length > 0) {
    const { error } = await supabase.from('qc_templates').insert(
      values.qcCheckpoints.map((cp, index) => ({
        product_id: productId,
        checkpoint_order: index + 1,
        checkpoint_name: cp.checkpoint_name,
      })),
    );
    if (error) throw error;
  }

  return getProductBundle(productId);
}

export async function getProductHubSummary(productId: string): Promise<ProductHubSummary> {
  const [productRes, bomRes, assemblyRes, qcRes, installFormRes] = await Promise.all([
    supabase.from('products').select('*').eq('id', productId).single(),
    supabase.from('bom').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    supabase.from('assembly_templates').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    supabase.from('qc_templates').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    supabase
      .from('product_forms')
      .select('id')
      .eq('product_id', productId)
      .eq('form_type', 'installation')
      .maybeSingle(),
  ]);

  if (productRes.error) throw productRes.error;

  return {
    product: productRes.data,
    bom_count: bomRes.count ?? 0,
    assembly_step_count: assemblyRes.count ?? 0,
    qc_checkpoint_count: qcRes.count ?? 0,
    has_installation_form: Boolean(installFormRes.data),
  };
}

export async function syncProductBom(productId: string, values: BomOnlyFormValues): Promise<ProductBundle> {
  const partIds = [...new Set(values.bom.map((r) => r.part_id))];
  if (partIds.length !== values.bom.length) {
    throw new Error('Each part can only appear once in the BOM.');
  }

  const { error: productError } = await supabase
    .from('products')
    .update({
      name: values.name,
      description: values.description ?? null,
    })
    .eq('id', productId);
  if (productError) throw productError;

  const { data: existingBom, error: bomFetchError } = await supabase
    .from('bom')
    .select('id, part_id')
    .eq('product_id', productId);
  if (bomFetchError) throw bomFetchError;

  const newPartIdSet = new Set(partIds);
  const toDelete = (existingBom ?? [])
    .filter((row) => !newPartIdSet.has(row.part_id))
    .map((row) => row.id);

  if (toDelete.length > 0) {
    const { error } = await supabase.from('bom').delete().in('id', toDelete);
    if (error) throw error;
  }

  for (const row of values.bom) {
    const { error } = await supabase.from('bom').upsert(
      {
        product_id: productId,
        part_id: row.part_id,
        qty_required: row.qty_required,
      },
      { onConflict: 'product_id,part_id' },
    );
    if (error) throw error;
  }

  return getProductBundle(productId);
}

function legacyAssemblyToForm(productName: string, steps: { step_name: string }[]): FormDefinition {
  if (steps.length === 0) return defaultFormDefinition('assembly', productName);
  return {
    title: `${productName} — Assembly`,
    description: '',
    fields: steps.map((step) => ({
      id: crypto.randomUUID(),
      type: 'section_header' as const,
      label: step.step_name,
    })),
  };
}

function legacyQcToForm(productName: string, checkpoints: { checkpoint_name: string }[]): FormDefinition {
  if (checkpoints.length === 0) return defaultFormDefinition('qc', productName);
  return {
    title: `${productName} — Quality check`,
    description: '',
    fields: checkpoints.map((cp) => ({
      id: crypto.randomUUID(),
      type: 'pass_fail' as const,
      label: cp.checkpoint_name,
      required: true,
    })),
  };
}

export async function getProductForm(
  productId: string,
  formType: ProductFormKind,
): Promise<FormDefinition> {
  const { data: formRow, error: formError } = await supabase
    .from('product_forms')
    .select('*')
    .eq('product_id', productId)
    .eq('form_type', formType)
    .maybeSingle();

  if (formError) throw formError;

  if (formRow) {
    const parsed = formDefinitionSchema.safeParse(formRow.definition);
    if (parsed.success) {
      return {
        title: formRow.title || parsed.data.title,
        description: formRow.description ?? parsed.data.description,
        fields: parsed.data.fields,
      };
    }
  }

  const bundle = await getProductBundle(productId);
  if (formType === 'assembly') {
    return legacyAssemblyToForm(bundle.product.name, bundle.assemblySteps);
  }
  if (formType === 'qc') {
    return legacyQcToForm(bundle.product.name, bundle.qcCheckpoints);
  }
  return defaultFormDefinition('installation', bundle.product.name);
}

async function syncLegacyAssemblyTemplates(productId: string, definition: FormDefinition) {
  const steps = extractAssemblySteps(definition);
  const { error: deleteError } = await supabase
    .from('assembly_templates')
    .delete()
    .eq('product_id', productId);
  if (deleteError) throw deleteError;

  if (steps.length > 0) {
    const { error } = await supabase.from('assembly_templates').insert(
      steps.map((step_name, index) => ({
        product_id: productId,
        step_order: index + 1,
        step_name,
      })),
    );
    if (error) throw error;
  }
}

async function syncLegacyQcTemplates(productId: string, definition: FormDefinition) {
  const checkpoints = extractQcCheckpoints(definition);
  const { error: deleteError } = await supabase.from('qc_templates').delete().eq('product_id', productId);
  if (deleteError) throw deleteError;

  if (checkpoints.length > 0) {
    const { error } = await supabase.from('qc_templates').insert(
      checkpoints.map((checkpoint_name, index) => ({
        product_id: productId,
        checkpoint_order: index + 1,
        checkpoint_name,
      })),
    );
    if (error) throw error;
  }
}

export async function saveProductForm(
  productId: string,
  formType: ProductFormKind,
  definition: FormDefinition,
): Promise<ProductFormRow> {
  const parsed = formDefinitionSchema.parse(definition);

  const { data, error } = await supabase
    .from('product_forms')
    .upsert(
      {
        product_id: productId,
        form_type: formType,
        title: parsed.title,
        description: parsed.description ?? null,
        definition: parsed,
      },
      { onConflict: 'product_id,form_type' },
    )
    .select('*')
    .single();

  if (error) throw error;

  if (formType === 'assembly') {
    await syncLegacyAssemblyTemplates(productId, parsed);
  } else if (formType === 'qc') {
    await syncLegacyQcTemplates(productId, parsed);
  }

  return {
    ...data,
    form_type: data.form_type as ProductFormKind,
    definition: parsed,
  };
}
