import { describe, it, expect } from 'vitest';

import { runSingle } from './helpers/runSingle';

describe('debuggerInstrumentation ‑ inline describe/it block', () => {
  it('steps through add() & subtract()', () => {
    const steps = runSingle(
      /* js */ `
      function add(a, b) { 
        const total = a + b; 
        return total 
      }

      function subtract(a, b) { 
        const difference = a - b; 
        return difference 
      }

      describe('Math', () => {
        describe('add', () => {
          it('adds numbers', () => {
            const x = add(1, 1);
            if (x !== 2) {
              throw new Error();
            }
          });
        });

        describe('subtract', () => {
          it('subtracts numbers', () => {
            const y = subtract(5, 3);
            if (y !== 2) {
              throw new Error();
            }
          });
        });
      });
    `, 'math.spec.js', { suiteName: 'RootSuite' });

    expect(steps).toMatchSnapshot();
  });
});
