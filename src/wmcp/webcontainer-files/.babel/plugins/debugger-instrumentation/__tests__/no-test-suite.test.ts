import { describe, it, expect } from 'vitest';

import { runSingle  } from './helpers/runSingle';

describe('debuggerInstrumentation ‑ single file', () => {
//   it('injects runtime stub & logs a basic step', () => {
//     const steps = runSingle('const a = 1;', 'basic_stub.ts');
//     expect(globalThis.__recordStep).toBeTypeOf('function');
//     expect(globalThis.__resetStepCounter).toBeTypeOf('function');
//     expect(steps).toMatchSnapshot();
//     expect(steps).toHaveLength(1);
//     expect(steps[0].vars).toMatchObject({ a: 1 });
//     expect(steps[0].line).toBe(1);
//     expect(steps[0].stepNumber).toBe(1);
//   });

  it('honours maxVars', () => {
    const [step] = runSingle('const a=1,b=2,c=3,d=4;', 'maxVars.ts', { maxVars: 2 });
    expect(Object.keys(step.vars).length).toBeLessThanOrEqual(2);
  });

  it('skips classic‑function arguments', () => {
    const steps = runSingle(`
      function foo(x, y){ return x + y }
      foo(4,5)
    `);
    expect(steps.some(s => 'arguments' in s.vars)).toBe(false);
  });

  it('instruments arrow fn implicit return', () => {
    const steps = runSingle(`
      const add = (m,n) => m + n;
      add(2,3);
    `);
    const got = steps.find(s => 'm' in s.vars && 'n' in s.vars);
    expect(got?.vars).toMatchObject({ m: 2, n: 3 });
  });

  it('wraps single‑line if‑statement', () => {
    const steps = runSingle(`
      let x = 0; if (x===0) x = 1;
    `);
    expect(steps.length).toBeGreaterThanOrEqual(2);
  });

  // it('sanitises funky suite / test names', () => {
  //   const steps = runSingle(
  //     `describe('My Suite/Weird:Name.v1', () => {
  //       test('weird test name: 1/2', () => { 
  //         const v = 42
  //       });
  //     });
  //     `,
  //     'snippet.js',
  //     { suiteName: 'My Suite/Weird:Name.v1' },
  //   );
  //   const hit = steps.find(s => s.test === 'weird test name: 1/2');
  //   expect(hit).toBeTruthy();
  // });

  it('increments stepNumber sequentially', () => {
    const steps = runSingle(`
      let sum=0; for(let i=0;i<5;i++) sum+=i;
    `);
    const nums = steps.map(s => s.stepNumber);
    expect(nums).toEqual([...nums].sort((a,b)=>a-b));
  });

  it('multi‑line if‑block detail (snapshot)', () => {
    const steps = runSingle(`
      let x = 0;
      if (x === 0) {
        x = 1;
      } else if (x === 1) {
        x = 2;
      } else { x = 3; }
    `);
    expect(steps).toMatchSnapshot();
  });

  it('captures loop‑scoped vars each iteration', () => {
    const steps = runSingle(`
      for(let j=0;j<3;j++){ const squared=j*j }
    `);
    const loopSteps = steps.filter(s => 'j' in s.vars && 'squared' in s.vars);
    expect(loopSteps).toHaveLength(3);
  });

  it('handles destructuring without TDZ', () => {
    const steps = runSingle(`const { a, b: renamed } = { a: 7, b: 9 };`);
    const step = steps.find((s) => 'a' in s.vars && 'renamed' in s.vars);
    expect(step?.vars).toMatchObject({ a: 7, renamed: 9 });
  });
});
