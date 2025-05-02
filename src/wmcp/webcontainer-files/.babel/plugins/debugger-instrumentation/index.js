export default function debuggerInstrumentation(babel) {
  const { types: t } = babel;

  /* -------------------------------------------------- *
   * Helpers                                            *
   * -------------------------------------------------- */

  const DEFAULT_MAX_VARS = 10;

  /** Build { get a() { try{ return a }catch{ return undefined } }, ... } */
  function buildVarsObjectAst(names, max) {
    const props = [];
    const sorted = Array.from(names || []).filter(Boolean).sort();
    for (let i = 0; i < sorted.length && i < max; i++) {
      const name = sorted[i];
      if (name === "arguments") continue; // pseudo‑var can break getters
      props.push(
        t.objectMethod(
          "get",
          t.identifier(name),
          [],
          t.blockStatement([
            t.tryStatement(
              t.blockStatement([t.returnStatement(t.identifier(name))]),
              t.catchClause(
                t.identifier("e"),
                t.blockStatement([t.returnStatement(t.identifier("undefined"))])
              )
            ),
          ])
        )
      );
    }
    return t.objectExpression(props);
  }

  /** Replace path‑unsafe chars → '_'  */
  function sanitizeForPath(str) {
    return typeof str === "string"
      ? str.replace(/[\s\\/?:*|"<>.]/g, "_").replace(/_+/g, "_")
      : "_invalid_";
  }

  /* -------------------------------------------------- *
   * Runtime stub (FS write & helpers)                  *
   * -------------------------------------------------- */
  function createRuntimeStubAst() {
    const requireFs = t.variableDeclaration("const", [
      t.variableDeclarator(
        t.identifier("fs"),
        t.callExpression(t.identifier("require"), [t.stringLiteral("fs")])
      ),
    ]);
    const requirePath = t.variableDeclaration("const", [
      t.variableDeclarator(
        t.identifier("path"),
        t.callExpression(t.identifier("require"), [t.stringLiteral("path")])
      ),
    ]);

    // ensureDirSync
    const ensureDirSync = t.variableDeclaration("const", [
      t.variableDeclarator(
        t.identifier("ensureDirSync"),
        t.arrowFunctionExpression(
          [t.identifier("dirPath")],
          t.blockStatement([
            t.variableDeclaration("const", [
              t.variableDeclarator(
                t.identifier("fullPath"),
                t.callExpression(
                  t.memberExpression(t.identifier("path"), t.identifier("join")),
                  [
                    t.callExpression(
                      t.memberExpression(
                        t.identifier("process"),
                        t.identifier("cwd")
                      ),
                      []
                    ),
                    t.stringLiteral(".timetravel"),
                    t.identifier("dirPath"),
                  ]
                )
              ),
            ]),
            t.tryStatement(
              t.blockStatement([
                t.expressionStatement(
                  t.callExpression(
                    t.memberExpression(t.identifier("fs"), t.identifier("mkdirSync")),
                    [
                      t.identifier("fullPath"),
                      t.objectExpression([
                        t.objectProperty(
                          t.identifier("recursive"),
                          t.booleanLiteral(true)
                        ),
                      ]),
                    ]
                  )
                ),
              ]),
              t.catchClause(
                t.identifier("err"),
                t.blockStatement([
                  t.ifStatement(
                    t.binaryExpression(
                      "!==",
                      t.memberExpression(t.identifier("err"), t.identifier("code")),
                      t.stringLiteral("EEXIST")
                    ),
                    t.blockStatement([
                      t.expressionStatement(
                        t.callExpression(
                          t.memberExpression(
                            t.identifier("console"),
                            t.identifier("error")
                          ),
                          [
                            t.stringLiteral(
                              "[TimeTravelPlugin] Error creating directory" +
                                " "
                            ),
                            t.identifier("err"),
                          ]
                        )
                      ),
                      t.throwStatement(t.identifier("err")),
                    ])
                  ),
                ])
              )
            ),
            t.returnStatement(t.identifier("fullPath")),
          ])
        )
      ),
    ]);

    // let stepNumber = 0;
    const stepCounter = t.variableDeclaration("let", [
      t.variableDeclarator(t.identifier("stepNumber"), t.numericLiteral(0)),
    ]);

    // __resetStepCounter
    const resetFn = t.expressionStatement(
      t.assignmentExpression(
        "=",
        t.memberExpression(t.identifier("globalThis"), t.identifier("__resetStepCounter")),
        t.arrowFunctionExpression([], t.blockStatement([
          t.expressionStatement(
            t.assignmentExpression("=", t.identifier("stepNumber"), t.numericLiteral(0))
          ),
        ]))
      )
    );
    resetFn.expression.right._generated_by_plugin_ = true;

    // __recordStep body (unchanged except dir build)
    const recordBody = t.blockStatement([
      t.expressionStatement(t.updateExpression("++", t.identifier("stepNumber"), true)),
      t.variableDeclaration("const", [
        t.variableDeclarator(t.identifier("clonedVars"), t.objectExpression([])),
      ]),
      // clone vars safely
      t.tryStatement(
        t.blockStatement([
          t.forOfStatement(
            t.variableDeclaration("const", [
              t.variableDeclarator(t.identifier("k")),
            ]),
            t.callExpression(
              t.memberExpression(
                t.identifier("Object"),
                t.identifier("getOwnPropertyNames")
              ),
              [t.identifier("v")]
            ),
            t.blockStatement([
              t.tryStatement(
                t.blockStatement([
                  t.expressionStatement(
                    t.assignmentExpression(
                      "=",
                      t.memberExpression(t.identifier("clonedVars"), t.identifier("k"), true),
                      t.memberExpression(t.identifier("v"), t.identifier("k"), true)
                    )
                  ),
                ]),
                t.catchClause(
                  t.identifier("_e"),
                  t.blockStatement([
                    t.expressionStatement(
                      t.assignmentExpression(
                        "=",
                        t.memberExpression(t.identifier("clonedVars"), t.identifier("k"), true),
                        t.identifier("undefined")
                      )
                    ),
                  ])
                )
              ),
            ])
          ),
        ]),
        t.catchClause(
          t.identifier("_e2"),
          t.blockStatement([
            t.expressionStatement(
              t.callExpression(
                t.memberExpression(t.identifier("console"), t.identifier("error")),
                [t.stringLiteral("[TimeTravelPlugin] Var clone error"), t.identifier("_e2")]
              )
            ),
          ])
        )
      ),
      // build record object
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier("stepData"),
          t.objectExpression([
            t.objectProperty(t.identifier("stepNumber"), t.identifier("stepNumber")),
            t.objectProperty(t.identifier("file"), t.identifier("f")),
            t.objectProperty(t.identifier("line"), t.identifier("l")),
            t.objectProperty(t.identifier("vars"), t.identifier("clonedVars")),
            t.objectProperty(
              t.identifier("ts"),
              t.callExpression(
                t.memberExpression(t.identifier("Date"), t.identifier("now")),
                []
              )
            ),
            t.objectProperty(t.identifier("suite"), t.identifier("sName")),
            t.objectProperty(t.identifier("test"), t.identifier("tName")),
          ])
        ),
      ]),
      // sanitise + path
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier("sanTest"),
          t.callExpression(
            t.memberExpression(
              t.callExpression(
                t.memberExpression(t.identifier("tName"), t.identifier("replace")),
                [t.regExpLiteral("[\\s\\\\/?:*|\"<>.]", "g"), t.stringLiteral("_")]
              ),
              t.identifier("replace")
            ),
            [t.regExpLiteral("_+", "g"), t.stringLiteral("_")]
          )
        ),
      ]),
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier("dirPath"),
          t.callExpression(
            t.memberExpression(t.identifier("path"), t.identifier("join")),
            [t.identifier("sName"), t.identifier("sanTest")]
          )
        ),
      ]),
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier("fullDirPath"),
          t.callExpression(t.identifier("ensureDirSync"), [t.identifier("dirPath")])
        ),
      ]),
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier("filePath"),
          t.callExpression(
            t.memberExpression(t.identifier("path"), t.identifier("join")),
            [
              t.identifier("fullDirPath"),
              t.templateLiteral(
                [t.templateElement({ raw: "" }), t.templateElement({ raw: ".json" }, true)],
                [t.identifier("stepNumber")]
              ),
            ]
          )
        ),
      ]),
      t.expressionStatement(
        t.callExpression(
          t.memberExpression(t.identifier("fs"), t.identifier("writeFileSync")),
          [
            t.identifier("filePath"),
            t.callExpression(
              t.memberExpression(t.identifier("JSON"), t.identifier("stringify")),
              [t.identifier("stepData"), t.nullLiteral(), t.numericLiteral(2)]
            ),
          ]
        )
      ),
    ]);

    // __recordStep = (f,l,v,sName,tName) => { … }
    const recordAssign = t.expressionStatement(
      t.assignmentExpression(
        "=",
        t.memberExpression(t.identifier("globalThis"), t.identifier("__recordStep")),
        t.arrowFunctionExpression(
          [
            t.identifier("f"),
            t.identifier("l"),
            t.identifier("v"),
            t.identifier("sName"),
            t.identifier("tName"),
          ],
          recordBody
        )
      )
    );
    recordAssign.expression.right._generated_by_plugin_ = true;

    // helper: init __currentSuite if missing
    const initCurrentSuite = t.expressionStatement(
      t.assignmentExpression(
        "=",
        t.memberExpression(t.identifier("globalThis"), t.identifier("__currentSuite")),
        t.logicalExpression(
          "??",
          t.memberExpression(t.identifier("globalThis"), t.identifier("__currentSuite")),
          t.stringLiteral("<DEFAULT_SUITE_PLACEHOLDER>") // replaced during injection
        )
      )
    );
    initCurrentSuite._generated_by_plugin_ = true;

    // final stub block
    const stubBody = t.blockStatement([
      requireFs,
      requirePath,
      ensureDirSync,
      stepCounter,
      resetFn,
      initCurrentSuite,
      recordAssign,
    ]);
    stubBody._generated_by_plugin_ = true;

    const ifStmt = t.ifStatement(
      t.unaryExpression(
        "!",
        t.memberExpression(t.identifier("globalThis"), t.identifier("__recordStep"))
      ),
      stubBody
    );
    ifStmt._generated_by_babel_plugin_time_travel_stub = true;

    return [ifStmt];
  }

  /* -------------------------------------------------- *
   * Nodes we do NOT instrument                         *
   * -------------------------------------------------- */
  const STATEMENTS_TO_SKIP = new Set([
    "FunctionDeclaration",
    "ClassDeclaration",
    // deliberately *not* skipping IfStatement or ThrowStatement now
    "SwitchStatement",
    "WhileStatement",
    "DoWhileStatement",
    "ForStatement",
    "ForInStatement",
    "ForOfStatement",
    "TryStatement",
    "CatchClause",
    "LabeledStatement",
    "ReturnStatement",
    "BreakStatement",
    "ContinueStatement",
    "DebuggerStatement",
    "EmptyStatement",
    "BlockStatement",
    "WithStatement",
    "SwitchCase",
    "ImportDeclaration",
    "ExportNamedDeclaration",
    "ExportDefaultDeclaration",
    "ExportAllDeclaration",
  ]);

  /* -------------------------------------------------- *
   * Recorder helper                                    *
   * -------------------------------------------------- */
  function createRecorderStatement(path, state, lineOverride = null, namesOverride = null) {
    if (
      path.node._is_recorder_call ||
      path.findParent(p => p.node._generated_by_babel_plugin_time_travel_stub || p.node._generated_by_plugin_)
    )
      return null;

    if (!path.node.loc) return null;

    const line = lineOverride ?? path.node.loc.start.line;
    const file = state.file.opts.filename || "unknown";

    const maxVars = state.opts?.maxVars ?? DEFAULT_MAX_VARS;
    if (maxVars <= 0) return null;

    let names;
    if (namesOverride) {
      names = namesOverride;
    } else {
      names = new Set(Object.keys(path.scope?.getAllBindings?.() || {}));
      try {
        if (typeof path.traverse === "function") {
          path.traverse({
            Identifier(idP) {
              if (!idP.isReferencedIdentifier()) return;
              const n = idP.node.name;
              names.add(n);
            },
          });
        }
      } catch (e) {
        console.error("[timeTravelPlugin] traverse error", e);
      }
    }

    const varsObj = buildVarsObjectAst(names, maxVars);

    // Runtime suite path (globalThis.__currentSuite ?? default)
    const suiteExpr = t.logicalExpression(
      "??",
      t.memberExpression(t.identifier("globalThis"), t.identifier("__currentSuite")),
      t.stringLiteral(sanitizeForPath(state.opts?.suiteName || "DefaultSuite"))
    );

    const recorderCall = t.callExpression(t.identifier("__recordStep"), [
      t.stringLiteral(file),
      t.numericLiteral(line),
      varsObj,
      suiteExpr,
      t.logicalExpression(
        "??",
        t.memberExpression(t.identifier("globalThis"), t.identifier("__testName")),
        t.stringLiteral("UnknownTest")
      ),
    ]);

    const stmt = t.expressionStatement(recorderCall);
    stmt._is_recorder_call = true;
    return stmt;
  }

  /* -------------------------------------------------- *
   * Visitor                                             *
   * -------------------------------------------------- */
  return {
    name: "time-travel-instrumentation-fs",
    visitor: {
      Program: {
        enter(programPath, state) {
          // ---- inject stub (only once) ----
          let hasStub = false;
          programPath.get("body").forEach(p => {
            if (p.isIfStatement() && p.node._generated_by_babel_plugin_time_travel_stub) hasStub = true;
          });
          if (!hasStub) {
            const stubNodes = createRuntimeStubAst();
            // replace default placeholder with real root suite name
            const defaultSuite = sanitizeForPath(state.opts?.suiteName || "DefaultSuite");
            stubNodes[0].consequent.body.forEach(n => {
              if (
                t.isExpressionStatement(n) &&
                n.expression.left &&
                n.expression.left.property &&
                n.expression.left.property.name === "__currentSuite"
              ) {
                n.expression.right.right = t.stringLiteral(defaultSuite);
              }
            });
            programPath.unshiftContainer("body", stubNodes);
          }
        },
      },
      // -------------- describe / it wrappers --------------
      CallExpression(path) {
        const callee = path.get("callee");
        if (!callee.isIdentifier()) return;
        const name = callee.node.name;

        // --------- DESCRIBE("…", fn) ---------
        if (name === "describe") {
          const [titleNode, fnNode] = path.get("arguments");
          if (!titleNode?.isStringLiteral()) return;
          const suiteName = sanitizeForPath(titleNode.node.value);
          if (!fnNode || !(fnNode.isFunctionExpression() || fnNode.isArrowFunctionExpression())) return;
          let bodyP = fnNode.get("body");
          if (!bodyP.isBlockStatement()) {
            bodyP.replaceWith(t.blockStatement([t.returnStatement(bodyP.node)]));
            bodyP = fnNode.get("body");
          }
          // ---- PUSH suiteName onto a stack ---------------------------------
          const pushStmts = [
            // initialise the stack if absent
            t.ifStatement(
              t.unaryExpression("!",
                t.memberExpression(t.identifier("globalThis"), t.identifier("__suiteStack"))
              ),
              t.expressionStatement(
                t.assignmentExpression("=",
                  t.memberExpression(t.identifier("globalThis"), t.identifier("__suiteStack")),
                  t.arrayExpression([])
                )
              )
            ),
            // push the new level
            t.expressionStatement(
              t.callExpression(
                t.memberExpression(
                  t.memberExpression(t.identifier("globalThis"), t.identifier("__suiteStack")),
                  t.identifier("push")
                ),
                [t.stringLiteral(suiteName)]
              )
            ),
            // recompute __currentSuite
            t.expressionStatement(
              t.assignmentExpression("=",
                t.memberExpression(t.identifier("globalThis"), t.identifier("__currentSuite")),
                t.callExpression(
                  t.memberExpression(
                    t.memberExpression(t.identifier("globalThis"), t.identifier("__suiteStack")),
                    t.identifier("join")
                  ),
                  [t.stringLiteral("/")]
                )
              )
            ),
          ];
          pushStmts.forEach(s => (s._generated_by_plugin_ = true));

          // ---- POP when the block finishes --------------------------------
          const popStmts = [
            t.expressionStatement(
              t.callExpression(
                t.memberExpression(
                  t.memberExpression(t.identifier("globalThis"), t.identifier("__suiteStack")),
                  t.identifier("pop")
                ),
                []
              )
            ),
            t.expressionStatement(
              t.assignmentExpression("=",
                t.memberExpression(t.identifier("globalThis"), t.identifier("__currentSuite")),
                t.callExpression(
                  t.memberExpression(
                    t.memberExpression(t.identifier("globalThis"), t.identifier("__suiteStack")),
                    t.identifier("join")
                  ),
                  [t.stringLiteral("/")]
                )
              )
            ),
          ];
          popStmts.forEach(s => (s._generated_by_plugin_ = true));

          bodyP.unshiftContainer("body", pushStmts);
          bodyP.pushContainer("body",    popStmts);
          return;
        }

        // --------- IT | TEST ("…", fn) -------------------------------------
        if (name === "it" || name === "test") {
          const [titleNode, fnNode] = path.get("arguments");
          if (!titleNode?.isStringLiteral()) return;
          if (!fnNode || !(fnNode.isFunctionExpression() || fnNode.isArrowFunctionExpression())) return;
          let bodyP = fnNode.get("body");
          if (!bodyP.isBlockStatement()) {
            bodyP.replaceWith(t.blockStatement([t.returnStatement(bodyP.node)]));
            bodyP = fnNode.get("body");
          }
          const assignTest = t.expressionStatement(
            t.assignmentExpression(
              "=",
              t.memberExpression(t.identifier("globalThis"), t.identifier("__testName")),
              t.stringLiteral(titleNode.node.value)
            )
          );
          assignTest._generated_by_plugin_ = true;
          bodyP.unshiftContainer("body", assignTest);
        }
      },

      // -------------- generic Statement instrumentation --------------
      Statement(path, state) {
        if (STATEMENTS_TO_SKIP.has(path.node.type)) return;
        if (
          path.isExpressionStatement() &&
          (t.isFunctionExpression(path.node.expression) || t.isArrowFunctionExpression(path.node.expression) || t.isClassExpression(path.node.expression))
        ) {
          return; // skip standalone function expressions
        }
        
        // Skip the *registration* calls themselves so we don't log them
        if (
          path.isExpressionStatement() &&
          path.get("expression").isCallExpression()
        ) {
          const callee = path.get("expression.callee");
          if (
            callee.isIdentifier({ name: "describe" }) ||
            callee.isIdentifier({ name: "it" }) ||
            callee.isIdentifier({ name: "test" })
          ) {
            return;
          }
        }
        
        const recStmt = createRecorderStatement(path, state);
        if (!recStmt) return;

        if (path.isThrowStatement()) {
          // We log **before** a throw so we still capture the state.
          path.insertBefore(recStmt);
        } else if (path.parentPath.isBlockStatement() || path.parentPath.isProgram()) {
          path.insertAfter(recStmt);
        } else if (
          !path.isBlockStatement() &&
          (path.parentPath.isIfStatement() || path.parentPath.isLoop() || path.parentPath.isWithStatement())
        ) {
          // wrap bare statements of control structures in a block
          const blk = t.blockStatement([path.node, recStmt]);
          path.replaceWith(blk);
        }
      },

      // -------------- function entry --------------
      Function(path, state) {
        if (path.node._generated_by_plugin_) return;
        if (!path.node.body || !path.node.loc) return;

        // Ensure body is a block
        let bodyP = path.get("body");
        if (!bodyP.isBlockStatement()) {
          bodyP.replaceWith(t.blockStatement([t.returnStatement(bodyP.node)]));
          bodyP = path.get("body");
        }

        const names = new Set(Object.keys(path.scope?.getAllBindings() || {}));
        if (!path.isArrowFunctionExpression()) names.add("arguments");

        const rec = createRecorderStatement(path, state, path.node.loc.start.line, names);
        if (!rec) return;
        bodyP.unshiftContainer("body", rec);
      },
    },
  };
}
