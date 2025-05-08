import { describe, it, expect } from 'vitest';
import path from 'node:path';

import { runSingle } from './helpers/runSingle';
import { runFixture } from './helpers/runFixture';

describe('debuggerInstrumentation ‑ multi‑file JS', () => {
  const fix = path.join(__dirname, '__fixtures__', 'math');
  it('imports & tracks line numbers', () => {
    const steps = runFixture(fix, 'test.js', { suiteName: 'MultiFileTest' });

    // quick sanity
    expect(steps.find((s) => s.vars?.total === 8)).toBeTruthy();
    expect(steps.find((s) => s.vars?.x === 8)).toBeTruthy();

    expect(steps).toMatchSnapshot();
  });
});

describe('debuggerInstrumentation ‑ TypeScript', () => {
  it('single TS snippet retains original lines', () => {
    const TS_SAMPLE = `
      interface Foo{bar:string}
      function baz(f:Foo){
        const x = f.bar;
        return x;
      }
      baz({bar:'hi'});
    `;
    const steps = runSingle(TS_SAMPLE, 'snippet.ts', { suiteName: 'RootSuite' });

    expect(steps.find((s) => s.line === 4)).toBeTruthy(); // inside function
    expect(steps).toMatchSnapshot();
  });

});
