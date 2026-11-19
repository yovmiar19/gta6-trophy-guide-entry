// Leonida Ledger, the entry program for gta6-trophy-guide-01 (Node 22, standard
// library only). The guide itself is app/: plain static files a browser opens
// at app/index.html with no build step and no network. This program hands the
// guide in: it copies app/ and screenshots/ from beside this file into the
// output directory and writes output/dossier.json, the summary the judge reads
// (the screenshots, the first load's files and bytes, and the source), using
// the vendored make.fun library. Leave vendor/makefun-frontend.ts untouched:
// the scorer requires dossier.json to be byte for byte what its own copy
// writes. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

if (!existsSync(join(repoRoot, 'app', 'index.html'))) {
  console.error('app/index.html is missing: nothing to hand in');
  process.exit(1);
}

function copyFolder(name: string): number {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) return 0;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  return readdirSync(to).length;
}

mkdirSync(outDir, { recursive: true });
const appEntries = copyFolder('app');
const shotEntries = copyFolder('screenshots');

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);
const { size } = statSync(join(outDir, 'dossier.json'));

console.log(`handed in ${appEntries} app entries and ${shotEntries} screenshots to ${outDir}`);
console.log(`dossier.json is ${size} bytes`);
