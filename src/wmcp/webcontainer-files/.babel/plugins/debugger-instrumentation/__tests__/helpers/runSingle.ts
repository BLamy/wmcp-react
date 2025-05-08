import { transformSync } from '@babel/core';
import fs   from 'node:fs';
import path from 'node:path';
import debuggerInstr from '../../index.js';
import {
  describe as vDescribe,
  it       as vIt,
  test     as vTest,
  expect   as vExpect,
  beforeEach as vBeforeEach,
  afterEach  as vAfterEach,
} from 'vitest';

export function runSingle(
  source: string,
  filename = 'snippet.ts',
  pluginOpts: Record<string, any> = {},
) {
  wipeGlobals();

  /* ---------- NEW: make vitest globals visible to the snippet ---------- */
  Object.assign(globalThis, {
    describe   : vDescribe,
    it         : vIt,
    test       : vTest,
    expect     : vExpect,
    beforeEach : vBeforeEach,
    afterEach  : vAfterEach,
  });
  /* -------------------------------------------------------------------- */

  const { code } = transformSync(source, {
    filename,
    presets : [['@babel/preset-typescript', { onlyRemoveTypeImports: true }]],
    plugins : [[debuggerInstr, { suiteName: 'single', ...pluginOpts }]],
    retainLines: true,
    // ignore: ['**/runSingle.ts', '**/runFixture.ts'],
  });

  new Function('require', 'module', 'exports', 'globalThis', code)(
    require,
    { exports: {} },
    {},
    globalThis,
  );

  return collectSteps(path.join(process.cwd(), '.timetravel'));
}

/* ─────────── helpers ─────────── */

function wipeGlobals() {
  for (const k of [
    '__recordStep',
    '__resetStepCounter',
    '__suiteStack',
    '__currentSuite',
  ])
    delete (globalThis as any)[k];
}

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
  return out.sort((a, b) => a.stepNumber - b.stepNumber).map(s => {
    delete s.ts;
    return s;
  });
}