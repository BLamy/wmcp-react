
# Understanding the Vitest Soft Expect Babel Plugin

This simple yet powerful Babel plugin automatically transforms all `expect()` assertions in Vitest tests to use `expect.soft()` instead, with a clever escape hatch. Let's break down how it works:

## What Does This Plugin Do?

```javascript
// This:
expect(result).toBe(42);

// Becomes:
expect.soft(result).toBe(42);

// Unless you add this escape hatch:
// hard
expect(result).toBe(42); // Stays unchanged
```

## How It Works

This plugin operates in three simple steps:

### 1. Find Expect Calls

```javascript
CallExpression(path) {
  // Only touch bare `expect(...)`
  const callee = path.get("callee");
  if (!callee.isIdentifier({ name: "expect" })) return;
  // ...
}
```

The plugin searches the AST for function calls where the function being called is specifically named `expect`.

### 2. Check for Escape Comments

```javascript
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
```

It looks for comments immediately before the statement containing the `expect` call. If it finds a comment that contains exactly `hard` (after trimming whitespace), it leaves the assertion unchanged.

### 3. Transform the Call

```javascript
// Replace with expect.soft(...)
callee.replaceWith(
  t.memberExpression(t.identifier("expect"), t.identifier("soft"))
);
```

If no escape comment was found, it transforms the call by replacing `expect` with `expect.soft`.

## Why This Is Useful

In Vitest, normal `expect()` assertions cause the entire test to fail and stop on the first failure. By using `expect.soft()`, a failed assertion will be reported, but the test will continue running, allowing you to see all failures at once instead of fixing them one by one.

This plugin makes all assertions "soft" by default, improving the testing workflow by:

1. **Showing all failures at once** - Instead of fixing one assertion at a time
2. **Reducing test iterations** - See all problems in a single test run
3. **Maintaining control** - Use the `// hard` comment when you need specific assertions to stop the test

## Real-World Applications

This plugin is particularly valuable for:

1. **Migrating large test suites** - Quickly find all failures without repeatedly running tests
2. **UI testing** - See all UI discrepancies at once rather than one at a time
3. **Data validation testing** - Check multiple properties of complex objects and get a complete report

## Implementation Elegance

The beauty of this plugin is its simplicity:
- Just ~25 lines of code
- No complex configuration
- Intuitive escape hatch mechanism
- Zero runtime overhead (all transformations happen at build time)

This demonstrates how Babel plugins can provide powerful, targeted transformations that meaningfully improve development workflows with minimal code.