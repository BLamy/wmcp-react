import fs         from 'node:fs';
import path       from 'node:path';
import { tmpdir } from 'node:os';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import register   from '@babel/register';
import debuggerInstr from '../../index.js';   

export function runFixture(
  fixtureDir: string,
  entryFile: string,
  pluginOpts: Record<string, any> = {},
) {
  const work = mkdtempSync(path.join(tmpdir(), 'tt-'));
  cpSync(fixtureDir, work, { recursive: true });

  const unregister = register({
    extensions: ['.js', '.ts', '.tsx'],
    presets   : [['@babel/preset-typescript', { onlyRemoveTypeImports: true }]],
    plugins   : [[debuggerInstr, { suiteName: 'fixture', ...pluginOpts }]],
    cache: false,
    cwd  : work,
  });

  require(path.join(work, entryFile));   // ► run test

  const steps = collectSteps(path.join(work, '.timetravel'));

  unregister();
  rmSync(work, { recursive: true, force: true });
  return steps.map(s => {
    delete s.ts;
    return s;
  });
}

/* ─────────── helpers ─────────── */
function collectSteps(root: string) {
  if (!fs.existsSync(root)) return [];
  const out: any[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d)) {
      const p = path.join(d, e);
      fs.statSync(p).isDirectory()
        ? walk(p)
        : e.endsWith('.json') && out.push(JSON.parse(fs.readFileSync(p, 'utf8')));
    }
  };
  walk(root);
  return out.sort((a, b) => a.stepNumber - b.stepNumber);
}