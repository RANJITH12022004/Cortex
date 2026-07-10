/**
 * Downloads Stitch screen HTML and DESIGN.md using the stitch-mcp CLI.
 * Run: STITCH_API_KEY=... node scripts/import-stitch.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ID = '16391226028490069095';
const OUT_DIR = 'stitch-import';
const SCREENS_DIR = join(OUT_DIR, 'screens');

const routes = [
  { screenId: '41cfcf2b9a1b4f628fa4d79aed034a5e', route: '/login', title: 'Login' },
  { screenId: '9482609546f04a6c93acd9ba36dfecfc', route: '/dashboard', title: 'Manager Dashboard' },
  { screenId: 'e9700e8d2f00427fa1c1f153136a79ba', route: '/command-center', title: 'Command Center' },
  { screenId: 'bed0a7e732dc44ebbf14a594ac32690b', route: '/products/setup', title: 'Product Setup' },
  { screenId: 'c62cb5c7a99048c08fc5019aebd9c7d5', route: '/procurement/stock-out', title: 'Stock-Out' },
  { screenId: 'e6a9abcd9c2c4ef08b9712e082e895eb', route: '/orders/detail', title: 'Order Detail' },
  { screenId: '7f9bc143be9f4e41ac33fe96c393f12b', route: '/orders', title: 'Order' },
  { screenId: 'c75f060908a24e8ab7a33a0e2132d810', route: '/tasks/production', title: 'Production Task' },
  { screenId: 'c97f024b994e41439e7dc28c1f457f63', route: '/tasks', title: 'Task' },
  { screenId: '9a18dcfa278644abbddc26f8b4bd0c75', route: '/qc/inspection', title: 'QC Inspection' },
  { screenId: '747b4fff3f284c2ebf49b5a437a6c211', route: '/qc/form', title: 'QC Form' },
];

function runTool(toolName, data) {
  const dataFile = join(OUT_DIR, `_tool-${toolName}.json`);
  writeFileSync(dataFile, JSON.stringify(data));
  const out = execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['-y', '@_davideast/stitch-mcp', 'tool', toolName, '-f', dataFile, '-o', 'json'],
    { encoding: 'utf8', env: process.env, shell: true },
  );
  return JSON.parse(out);
}

mkdirSync(SCREENS_DIR, { recursive: true });

const projects = runTool('list_projects', {});
const project = projects.projects.find((p) => p.name.includes(PROJECT_ID));
if (!project) throw new Error('Project not found');

const designMd = project.designTheme?.designMd;
if (designMd) {
  writeFileSync('DESIGN.md', designMd);
  writeFileSync(join(OUT_DIR, 'DESIGN.md'), designMd);
  console.log('Wrote DESIGN.md');
}

writeFileSync(join(OUT_DIR, 'project-meta.json'), JSON.stringify(project, null, 2));

const manifest = [];

for (const route of routes) {
  const screen = runTool('get_screen', { projectId: PROJECT_ID, screenId: route.screenId });
  const downloadUrl = screen.htmlCode?.downloadUrl;
  if (!downloadUrl || screen.htmlCode?.mimeType !== 'text/html') {
    console.log(`Skipping ${route.title} (no HTML)`);
    continue;
  }

  const html = await fetch(downloadUrl).then((r) => r.text());
  const filename = `${route.route.replace(/\//g, '_').replace(/^_/, '') || 'index'}.html`;
  const filepath = join(SCREENS_DIR, filename);
  writeFileSync(filepath, html);
  manifest.push({ ...route, filename, stitchTitle: screen.title });
  console.log(`Downloaded ${route.title} -> ${filepath}`);
}

writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Done. Manifest:', join(OUT_DIR, 'manifest.json'));
