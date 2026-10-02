import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const products = [
  ['Friability Tester', 'sample/friability-tester-bom.csv'],
  ['Antibiotic Zone Reader MZR', 'sample/antibiotic-zone-reader-mzr-bom.csv'],
  ['Tapped Density Apparatus RDT-2P', 'sample/tapped-density-apparatus-rdt-2p-bom.csv'],
  ['Manual Hardness Tester Touch Screen', 'sample/manual-hardness-tester-touch-screen-bom.csv'],
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows.slice(1);
}

function sqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const lines = [];
for (const [name, file] of products) {
  const rows = parseCsv(readFileSync(join(root, file), 'utf8'));
  const items = rows
    .map((cols) => ({
      qty: Number(cols[0]),
      part: (cols[1] ?? '').trim(),
      description: (cols[2] ?? '').trim(),
    }))
    .filter((item) => item.part && Number.isFinite(item.qty) && item.qty > 0);
  const payload = items
    .map(
      (item) =>
        `jsonb_build_object('part', ${sqlText(item.part)}, 'qty', ${item.qty}, 'description', ${sqlText(item.description)})`,
    )
    .join(',\n    ');
  lines.push(
    `SELECT public.import_product_bom(${sqlText(name)}, ARRAY[\n    ${payload}\n  ]::jsonb[]);`,
  );
}

writeFileSync(join(root, 'scripts', 'product-boms.sql'), lines.join('\n'), 'utf8');
console.log('wrote product-boms.sql');
