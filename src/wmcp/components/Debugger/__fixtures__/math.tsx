// Sample files for the debugger
export const files = {
  "math.spec.js": {
    file: {
      contents: /* js */ `function add(a, b) { 
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
  });`,
    },
  },
};

// Sample debug steps
export const debugSteps = {
  "math.spec.js": {
    Math: {
      add: {
        "adds numbers": [
          {
            line: 13,
            file: "math.spec.js",
            sourceCode: "it('adds numbers', () => {",
            vars: {},
          },
          {
            line: 14,
            file: "math.spec.js",
            sourceCode: "const x = add(1, 1);",
            vars: {},
          },
          {
            line: 2,
            file: "math.spec.js",
            sourceCode: "const total = a + b;",
            vars: {
              a: 1,
              b: 1,
            },
          },
          {
            line: 3,
            file: "math.spec.js",
            sourceCode: "return total",
            vars: {
              a: 1,
              b: 1,
              total: 2,
            },
          },
          {
            line: 15,
            file: "math.spec.js",
            sourceCode: "if (x !== 2) {",
            vars: {
              x: 2,
            },
          },
          {
            line: 18,
            file: "math.spec.js",
            sourceCode: "});",
            vars: {
              x: 2,
            },
          },
        ],
      },
      subtract: {
        "subtracts numbers": [
          {
            line: 21,
            file: "math.spec.js",
            sourceCode: "it('subtracts numbers', () => {",
            vars: {},
          },
          {
            line: 22,
            file: "math.spec.js",
            sourceCode: "const y = subtract(5, 3);",
            vars: {},
          },
          {
            line: 7,
            file: "math.spec.js",
            sourceCode: "const difference = a - b;",
            vars: {
              a: 5,
              b: 3,
            },
          },
          {
            line: 8,
            file: "math.spec.js",
            sourceCode: "return difference",
            vars: {
              a: 5,
              b: 3,
              difference: 2,
            },
          },
          {
            line: 23,
            file: "math.spec.js",
            sourceCode: "if (y !== 2) {",
            vars: {
              y: 2,
            },
          },
          {
            line: 26,
            file: "math.spec.js",
            sourceCode: "});",
            vars: {
              y: 2,
            },
          },
        ],
      },
    },
  },
};
