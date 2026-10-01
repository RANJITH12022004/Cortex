import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'partsbox-parts (1).csv');

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
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }
  return rows;
}

function sqlText(value) {
  if (value == null || String(value).trim() === '') return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function place(where) {
  let loc = String(where ?? '')
    .trim()
    .replace(/\s*\(\s*\d+(?:\.\d+)?\s*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!loc) {
    return { rack: 'UNASSIGNED', rackName: 'Unassigned', box: 'UNASSIGNED', boxName: 'Unassigned' };
  }
  const rackMatch = loc.match(/rack\s*(\d+)/i);
  if (rackMatch) {
    return {
      rack: `RACK-${rackMatch[1]}`,
      rackName: `Rack ${rackMatch[1]}`,
      box: loc.toUpperCase(),
      boxName: loc,
    };
  }
  return { rack: 'STORE', rackName: 'Store', box: loc.toUpperCase(), boxName: loc };
}

function lastUsed(value) {
  const match = String(value ?? '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  return `${year}-${month}-${day} ${hour}:${minute}:00+05:30`;
}

const rows = parseCsv(readFileSync(source, 'utf8'));
const data = rows.slice(1);
const statements = data.map((cols) => {
  const name = (cols[0] ?? '').trim();
  const description = (cols[1] ?? '').trim();
  const footprint = (cols[3] ?? '').trim();
  const qty = Number(cols[4]);
  const used = lastUsed(cols[5]);
  const spot = place(cols[6]);
  return `SELECT public.import_partsbox_row(${sqlText(name)}, ${sqlText(description)}, ${sqlText(footprint)}, ${Number.isFinite(qty) ? qty : 0}, ${used ? sqlText(used) : 'NULL'}::timestamptz, ${sqlText(spot.rack)}, ${sqlText(spot.rackName)}, ${sqlText(spot.box)}, ${sqlText(spot.boxName)});`;
});

const outDir = join(root, 'scripts', 'partsbox-sql');
mkdirSync(outDir, { recursive: true });
const size = 80;
let batch = 0;
for (let i = 0; i < statements.length; i += size) {
  batch += 1;
  writeFileSync(join(outDir, `batch-${String(batch).padStart(2, '0')}.sql`), statements.slice(i, i + size).join('\n'), 'utf8');
}
console.log(`parts ${data.length} batches ${batch}`);
