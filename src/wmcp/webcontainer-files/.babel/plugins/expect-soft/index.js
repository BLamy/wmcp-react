// babel-plugin-vitest-soft-expect.js
// Transform plain   expect(value)   →   expect.soft(value)
// Escape-hatch: if the statement has a leading   // hard   comment,
//               the call is left unchanged.

export default function expectSoft(babel) {
    const { types: t } = babel;

    return {
      name: "vitest-soft-expect-transform",
      visitor: {
        CallExpression(path) {
          // Only touch bare `expect(...)`
          const callee = path.get("callee");
          if (!callee.isIdentifier({ name: "expect" })) return;
  
          // Find the nearest statement node (usually ExpressionStatement)
          const stmtPath = path.findParent(p => p.isStatement());
          if (stmtPath) {
            const { leadingComments = [] } = stmtPath.node;
  
            // If any leading comment is exactly "hard", skip the transform
            const hasHardEscape = leadingComments.some(c =>
              c.value.trim() === "hard"
            );
            if (hasHardEscape) return;
          }
  
          // Replace with expect.soft(...)
          callee.replaceWith(
            t.memberExpression(t.identifier("expect"), t.identifier("soft"))
          );
        },
      },
    };
  };