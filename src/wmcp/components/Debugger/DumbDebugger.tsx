/* DumbDebugger.tsx — standalone "dumb" debugger component
   ------------------------------------------------------------------
   * No WebContainer deps
   * Built‑in scroll isolation (the page itself never scrolls)
   * CodeMirror handles its own scrollbar
*/

"use client";

import React, {
  FC,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  EditorState,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  EditorView,
  Decoration,
  DecorationSet,
} from "@codemirror/view";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

import "./debugger.css";

/* ------------------------------------------------------------------ */
/* Public API types                                                    */
/* ------------------------------------------------------------------ */
export interface DumbFileMap {
  [filename: string]: { file: { contents: string } };
}

export interface DebugStep {
  file: string;
  line: number;                    // 1‑based
  vars?: Record<string, unknown>;
  sourceCode?: string;             // optional, purely informational
}

export interface DebuggerProps {
  files: DumbFileMap;
  debugSteps: Record<string, any>; // arbitrarily deep suites → tests
}

/* ------------------------------------------------------------------ */
/* CodeMirror highlight plumbing                                       */
/* ------------------------------------------------------------------ */
const clearHighlight = StateEffect.define();
const addHighlight = StateEffect.define<DecorationSet>();
const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(clearHighlight)) return Decoration.none;
      if (e.is(addHighlight)) return e.value;
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f),
});

/* ------------------------------------------------------------------ */
/* Helper formatter                                                    */
/* ------------------------------------------------------------------ */
const formatVal = (v: unknown) => {
  if (v === undefined) return <span className="undefined">undefined</span>;
  if (v === null) return <span className="null">null</span>;
  if (typeof v === "boolean") return <span className="boolean">{String(v)}</span>;
  if (typeof v === "number")  return <span className="number">{v}</span>;
  if (typeof v === "string")  return <span className="string">"{v}"</span>;
  return <span className="object">{JSON.stringify(v)}</span>;
};

/* ------------------------------------------------------------------ */
/* CodeEditor (read‑only, owns its own scrollbar)                      */
/* ------------------------------------------------------------------ */
const CodeEditor: FC<{
  currentFile: string;
  files: DumbFileMap;
  onReady: (view: EditorView) => void;
}> = ({ currentFile, files, onReady }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: files[currentFile]?.file.contents ?? "",
        extensions: [
          basicSetup,
          javascript(),
          oneDark,
          highlightField,
          EditorView.editable.of(false),
          EditorView.theme({
            "&": { height: "100%" },
            ".cm-scroller": { overflow: "auto", maxHeight: "100%" }
          }),
        ],
      }),
    });

    onReady(view);
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFile]);

  return <div ref={hostRef} className="h-full w-full" />;
};

/* ------------------------------------------------------------------ */
/* DebuggerPanel                                                       */
/* ------------------------------------------------------------------ */
const DebuggerPanel: FC<{
  steps: DebugStep[];
  onStepSelect: (s: DebugStep) => void;
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
}> = ({ steps, onStepSelect, stepIndex, onStepIndexChange }) => {
  useEffect(() => {
    if (steps.length) onStepSelect(steps[stepIndex]);
  }, [stepIndex, steps, onStepSelect]);

  return (
    <div className="wallaby-debugger flex flex-col h-full w-full overflow-hidden bg-[#252526] text-[#e0e0e0] text-[13px]">
      {/* controls */}
      <div className="debugger-controls flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] border-b border-[#333] text-sm">
        <button onClick={() => onStepIndexChange(0)}>⏮️</button>
        <button onClick={() => onStepIndexChange(Math.max(0, stepIndex - 1))}>◀️</button>
        <div className="flex-1 text-center text-xs">
          Step {stepIndex + 1}/{steps.length}
        </div>
        <button onClick={() => onStepIndexChange(Math.min(steps.length - 1, stepIndex + 1))}>▶️</button>
        <button onClick={() => onStepIndexChange(steps.length - 1)}>⏭️</button>
      </div>

      {/* timeline */}
      <div className="timeline h-[30px] flex items-center px-3 bg-[#2a2a2a]">
        <div className="timeline-track w-full h-1 bg-[#3c3c3c] flex">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`timeline-point ${i === stepIndex ? "active" : ""}`}
              onClick={() => onStepIndexChange(i)}
            />
          ))}
        </div>
      </div>

      {/* vars */}
      <div className="variables-panel flex-1 overflow-y-auto pb-3">
        {steps[stepIndex]?.vars ? (
          Object.entries(steps[stepIndex].vars!).map(([k, v]) => {
            const changed =
              stepIndex > 0 &&
              JSON.stringify(steps[stepIndex - 1]?.vars?.[k]) !== JSON.stringify(v);
            return (
              <div
                key={k}
                className={`variable px-3 py-1 flex justify-between ${changed ? "changed" : ""}`}
              >
                <span className="var-name">{k}</span>
                {formatVal(v)}
              </div>
            );
          })
        ) : (
          <div className="no-data-message px-4 py-2 text-[#888]">
            No vars for this step
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* TestList                                                            */
/* ------------------------------------------------------------------ */
const TestList: FC<{
  tests: Record<string, DebugStep[]>;
  onSelect: (steps: DebugStep[]) => void;
}> = ({ tests, onSelect }) => (
  <div className="test-list-container h-full overflow-y-auto text-[13px]">
    {Object.keys(tests).length === 0 ? (
      <div className="no-data-message p-4 text-[#888] text-center">
        No tests with debug data.
      </div>
    ) : (
      <ul>
        {Object.entries(tests).map(([name, steps]) => (
          <li
            key={name}
            className="debug-test-item flex justify-between px-4 py-1 hover:bg-[#2a2d2e] cursor-pointer"
            onClick={() => onSelect(steps)}
          >
            <span className="test-name flex-1">{name}</span>
            <span className="test-steps text-xs text-[#888]">{steps.length} steps</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* flatten *any‑depth* debugSteps                                      */
/* ------------------------------------------------------------------ */
const flattenDebugSteps = (raw: Record<string, any>) => {
  const out: Record<string, DebugStep[]> = {};
  const visited = new WeakSet(); // Track visited objects to prevent circular recursion

  const walk = (node: any, trail: string[], defaultFile?: string) => {
    if (!node || typeof node !== 'object') return; // Skip primitives
    if (visited.has(node)) return; // Skip already visited objects to prevent circular recursion
    visited.add(node);

    for (const [k, v] of Object.entries(node)) {
      if (Array.isArray(v)) {
        const key = [...trail, k].join(" / ");
        // Only process arrays that look like DebugStep[] (have file and line properties)
        if (v.length > 0 && (v[0].file || v[0].line)) {
          out[key] = (v as DebugStep[]).map(step => ({
            ...step,
            file: step.file ?? defaultFile!,
          }));
        }
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        // Only recurse into objects, not arrays or primitives
        walk(v, [...trail, k], defaultFile);
      }
    }
  };

  for (const [specFile, suites] of Object.entries(raw)) {
    walk(suites, [specFile.replace(/\.[^/.]+$/, "")], specFile);
  }

  return out;
};

/* ------------------------------------------------------------------ */
/* MAIN Debugger component                                             */
/* ------------------------------------------------------------------ */
const Debugger: FC<DebuggerProps> = ({ files, debugSteps }) => {
  const parsedTests   = useMemo(() => flattenDebugSteps(debugSteps), [debugSteps]);
  const fileList      = useMemo(() => Object.keys(files), [files]);

  const [currentFile, setCurrentFile]   = useState(fileList[0] ?? "");
  const [showDebugger, setShowDebugger] = useState(true);
  const [selected, setSelected]         = useState<DebugStep[] | null>(null);
  const [stepIndex, setStepIndex]       = useState(0);

  const viewRef = useRef<EditorView | null>(null);

  /* reset step index when selected test changes --------------------------- */
  const handleTestSelect = (steps: DebugStep[]) => {
    setSelected(steps);
    setStepIndex(0);
  };

  /* highlight helpers ------------------------------------------------ */
  const clearHighlights = () => {
    if (viewRef.current) {
      viewRef.current.dispatch({ effects: clearHighlight.of(null) });
    }
  };

  const highlightLine = (line: number) => {
    const view = viewRef.current;
    if (!view) return;
    const { doc } = view.state;
    if (line < 1 || line > doc.lines) return;

    const info = doc.line(line);
    const deco = Decoration.set([
      Decoration.mark({ attributes: { class: "cm-debugger-highlight" } }).range(info.from, info.to),
    ]);
    view.dispatch({ effects: [addHighlight.of(deco)], selection: { anchor: info.from }, scrollIntoView: true });
  };

  /* sync selection with editor -------------------------------------- */
  const handleStepSelect = (s: DebugStep) => {
    if (s.file !== currentFile) {
      clearHighlights();
      setCurrentFile(s.file);
      setTimeout(() => highlightLine(s.line), 50);
    } else {
      highlightLine(s.line);
    }
  };

  /* ------------------------------------------------------------------ */
  /* JSX                                                                */
  /* ------------------------------------------------------------------ */
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#1e1e1e] text-[#e0e0e0] font-sans">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Editor pane ------------------------------------------------- */}
        <div className="flex flex-col flex-1 min-w-[300px] overflow-hidden">
          {/* file tabs */}
          <div className="flex bg-[#252526] border-b border-[#333]">
            {fileList.map(f => (
              <button
                key={f}
                className={`px-4 py-2 text-sm border-r border-[#252526] relative ${
                  currentFile === f
                    ? "bg-[#1e1e1e] text-white after:absolute after:h-[2px] after:bg-[#007acc] after:bottom-0 after:left-0 after:right-0"
                    : "text-[#969696] hover:text-white hover:bg-[#2a2d2e]"
                }`}
                onClick={() => {
                  clearHighlights();
                  setCurrentFile(f);
                }}
              >
                {f}
              </button>
            ))}

            {/* debugger toggle */}
            <button
              title="Toggle Debugger"
              className={`ml-auto mr-2 my-1 w-7 h-7 flex items-center justify-center rounded-sm transition ${
                showDebugger
                  ? "bg-[#007acc] text-white"
                  : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
              }`}
              onClick={() => {
                clearHighlights();
                setShowDebugger(v => !v);
              }}
            >
              🐞
            </button>
          </div>

          {/* CodeMirror host */}
          <div className="relative flex-1 bg-[#1e1e1e] overflow-hidden">
            <CodeEditor
              currentFile={currentFile}
              files={files}
              onReady={v => (viewRef.current = v)}
            />
          </div>
        </div>

        {/* Debugger pane ---------------------------------------------- */}
        {showDebugger && (
          <div className="flex flex-col w-[400px] border-l border-[#333] bg-[#252526]">
            {/* test list */}
            <div className="h-[300px] border-b border-[#333] overflow-hidden">
              <TestList tests={parsedTests} onSelect={handleTestSelect} />
            </div>

            {/* step viewer */}
            <div className="flex-1 overflow-hidden">
              {selected ? (
                <DebuggerPanel 
                  steps={selected} 
                  onStepSelect={handleStepSelect}
                  stepIndex={stepIndex}
                  onStepIndexChange={setStepIndex}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[#888] text-sm">
                  Select a test to debug
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Debugger;