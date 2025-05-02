// WebContainerDebugger.tsx – fully declarative React component
// (no direct DOM manipulation)

"use client";

import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { WebContainerContext } from "@/wmcp/providers/Webcontainer";

import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import "./debugger.css";
// @ts-ignore – vite virtual files
import { files } from "virtual:webcontainer-files";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface DebugStep {
  file: string;
  line: number;
  vars?: Record<string, unknown>;
}
interface TestSuiteData {
  [suite: string]: {
    [test: string]: DebugStep[];
  };
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
  provide: (f) => EditorView.decorations.from(f),
});

/* ------------------------------------------------------------------ */
/* Helper formatters                                                   */
/* ------------------------------------------------------------------ */
const formatVal = (v: unknown) => {
  if (v === undefined) return <span className="undefined">undefined</span>;
  if (v === null) return <span className="null">null</span>;
  if (typeof v === "boolean")
    return <span className="boolean">{String(v)}</span>;
  if (typeof v === "number") return <span className="number">{v}</span>;
  if (typeof v === "string") return <span className="string">"{v}"</span>;
  return <span className="object">{JSON.stringify(v)}</span>;
};

/* ------------------------------------------------------------------ */
/* CodeEditor component                                                */
/* ------------------------------------------------------------------ */
const CodeEditor: FC<{
  currentFile: string;
  onChange: (code: string) => void;
  onReady: (view: EditorView) => void;
}> = ({ currentFile, onChange, onReady }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const getFileContents = (path: string) => {
      const parts = path.split('/');
      let current: any = files;
      
      // Navigate through the path
      for (let i = 0; i < parts.length; i++) {
        if (current[parts[i]].file) return current[parts[i]].file.contents;
        current = current[parts[i]].directory;
      }
      
      return current?.file?.contents ?? "";
    };
    
    const initial = getFileContents(currentFile);
    // debugger
    const state = EditorState.create({
      doc: initial,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        highlightField,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
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
}> = ({ steps, onStepSelect }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (steps.length) onStepSelect(steps[idx]);
  }, [idx, steps, onStepSelect]);

  return (
    <div className="wallaby-debugger flex flex-col h-full w-full overflow-hidden bg-[#252526] text-[#e0e0e0] text-[13px]">
      {/* controls */}
      <div className="debugger-controls flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] border-b border-[#333] text-sm">
        <button onClick={() => setIdx(0)}>⏮️</button>
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))}>◀️</button>
        <div className="flex-1 text-center text-xs">
          Step {idx + 1}/{steps.length}
        </div>
        <button
          onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
        >
          ▶️
        </button>
        <button onClick={() => setIdx(steps.length - 1)}>⏭️</button>
      </div>

      {/* timeline */}
      <div className="timeline h-[30px] flex items-center px-3 bg-[#2a2a2a]">
        <div className="timeline-track w-full h-1 bg-[#3c3c3c] flex">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`timeline-point ${i === idx ? "active" : ""}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      </div>

      {/* vars */}
      <div className="variables-panel flex-1 overflow-y-auto pb-3">
        {steps[idx]?.vars ? (
          Object.entries(steps[idx].vars!).map(([k, v]) => {
            const changed =
              idx > 0 &&
              JSON.stringify(steps[idx - 1]?.vars?.[k]) !== JSON.stringify(v);
            return (
              <div
                key={k}
                className={`variable px-3 py-1 flex justify-between ${
                  changed ? "changed" : ""
                }`}
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
  tests: {
    [test: string]: DebugStep[];
  };
  onSelect: (steps: DebugStep[]) => void;
}> = ({ tests = {}, onSelect }) => (
  <div className="test-list-container h-full overflow-y-auto text-[13px]">
    {Object.entries(tests).length === 0 && (
      <div className="no-data-message p-4 text-[#888] text-center">
        No tests with debug data.
      </div>
    )}
    <ul>
      {Object.entries(tests).map(([name, steps]) => (
        <li
          key={name}
          className="debug-test-item flex justify-between px-4 py-1 hover:bg-[#2a2d2e] cursor-pointer"
          onClick={() => onSelect(Object.values(steps))}
        >
          <span className="test-name flex-1">{name}</span>
          <span className="test-steps text-xs text-[#888]">
            {Object.values(steps).length} steps
          </span>
        </li>
      ))}
    </ul>
  </div>
);

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
const WebContainerDebugger: FC = () => {
  const { webContainer, status: webContainerStatus } =
    useContext(WebContainerContext);

  // UI state
  const [currentFile, setCurrentFile] = useState("index.js");
  const [showDebugger, setShowDebugger] = useState(true);
  const [suites, setSuites] = useState<TestSuiteData>({});
  const [debugSteps, setDebugSteps] = useState<DebugStep[] | null>(null);
  const [status, setStatus] = useState({ text: "Booting Webcontainer...", color: "#3BB446" });
  const [stats, setStats] = useState({ total: 0, passing: 0, time: "--" });

  // CodeMirror view ref
  const viewRef = useRef<EditorView | null>(null);

  // available JS files
  const filesAvailable = ['index.js', 'index.test.js']

  useEffect(() => {
    switch (webContainerStatus) {
      case "booting":
      case "none":
        setStatus({ text: "Booting Webcontainer...", color: "#E0AF0B" });
        break;
      case "installing":
      case "mounting":
        setStatus({ text: "Installing node_modules...", color: "#E0AF0B" });
        break;

      case "error":
        setStatus({ text: "Error", color: "#E74C3C" });
        break;
    }
  }, [webContainerStatus]);

  /* ----------------- editor helpers ----------------- */
  const clearHighlightFx = () =>
    viewRef.current?.dispatch({ effects: clearHighlight.of(null) });

  const highlightLine = (line: number) => {
    const view = viewRef.current;
    if (!view) return;
    const { doc } = view.state;
    if (line >= doc.lines) return;
    try {
      const info = doc.line(line + 1);
      const deco = Decoration.set([
        Decoration.mark({
          attributes: {
            class: "cm-debugger-highlight",
          },
        }).range(info.from, info.to),
      ]);
      view.dispatch({
        effects: [addHighlight.of(deco)],
        selection: { anchor: info.from },
        scrollIntoView: true,
      });

      setTimeout(() => {
        if (!viewRef.current) return;
        viewRef.current.dispatch({
          selection: { anchor: info.from },
          scrollIntoView: true,
        });
      }, 50);
    } catch (e) {
      console.error("Error highlighting line:", e);
    }
  };

  /* ----------------- run tests & collect debug data -------------- */
  useEffect(() => {
    if (!webContainer || webContainerStatus !== "ready") {console.log("not ready"); return;}
    const run = async () => {
      setStatus({ text: "Running tests…", color: "#E0AF0B" });
      const t0 = performance.now();
      const proc = await webContainer.spawn("npm", [
        "test"
      ]);
      await proc.exit;
      const dt = Math.round(performance.now() - t0);

      // collect
      const collected: TestSuiteData = {};
      try {
        const dirs = await webContainer.fs.readdir("/.timetravel", {
          withFileTypes: true,
        });
        for (const dir of dirs.filter((d: any) => d.isDirectory())) {
          const suite = dir.name;
          if (["DefaultSuite", "UnknownTest"].includes(suite)) continue;
          collected[suite] = {};
          const filesDir = await webContainer.fs.readdir(
            `/.timetravel/${suite}`,
            {
              withFileTypes: true,
            }
          );
          for (const f of filesDir.filter((fd: any) =>
            fd.name.endsWith(".json")
          )) {
            const testName = f.name.endsWith(".json")
              ? f.name.slice(0, -5)
              : f.name;
            const jsonStr = await webContainer.fs.readFile(
              `/.timetravel/${suite}/${f.name}`,
              "utf-8"
            );
            collected[suite][testName] = JSON.parse(jsonStr);
          }
        }
      } catch {
        /* ignore */
      }

      const totalTests = Object.values(collected).length;
      setStats({ total: totalTests, passing: totalTests, time: `${dt}ms` });
      setSuites(collected);
      setStatus({ text: "Tests finished", color: "#3BB446" });
    };
    run();
  }, [webContainer, webContainerStatus]);

  /* ----------------- step selection -> highlight ----------------- */
  const handleStepSelect = (step: DebugStep) => {
    // Extract just the filename from the full path
    // This handles paths like "home/dir/utils.js" or "/home/dir/utils.js"
    const fileName = step.file.split("/").slice(3).join("/") || "";

    // Check if we need to switch files
    if (fileName !== currentFile) {
      console.log(
        `Switching from ${currentFile} to ${fileName} (original: ${step.file})`
      );
      setCurrentFile(fileName);

      // Give the file change time to take effect before highlighting
      setTimeout(() => {
        highlightLine(step.line);
      }, 50);
    } else {
      highlightLine(step.line);
    }
  };

  /* ----------------- editor change ------------------------------- */
  const handleCodeChange = (code: string) => {
    (files as any)[currentFile].file.contents = code;
    if (webContainer) webContainer.fs.writeFile("/" + currentFile, code);
  };

  /* ----------------- JSX ----------------------------------------- */
  return (
    <div className="flex flex-col h-screen w-full bg-[#1e1e1e] text-[#e0e0e0] font-sans">
      {/* main split */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* editor pane */}
        <div className="flex flex-col flex-1 min-w-[300px] overflow-hidden">
          {/* header */}
          <div className="flex justify-between bg-[#252526] border-b border-[#333]">
            <div className="flex">
              {filesAvailable.map((f) => (
                <button
                  key={f}
                  className={`px-4 py-2 text-sm border-r border-[#252526] relative ${
                    currentFile === f
                      ? "bg-[#1e1e1e] text-white after:absolute after:h-[2px] after:bg-[#007acc] after:bottom-0 after:left-0 after:right-0"
                      : "text-[#969696] hover:text-white hover:bg-[#2a2d2e]"
                  }`}
                  onClick={() => {
                    clearHighlightFx();
                    setCurrentFile(f);
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* debugger toggle */}
            <div className="flex items-center pr-2">
              <button
                title="Toggle Debugger"
                className={`w-7 h-7 flex items-center justify-center rounded-sm transition ${
                  showDebugger
                    ? "bg-[#007acc] text-white"
                    : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                }`}
                onClick={() => {
                  clearHighlightFx();
                  setShowDebugger((v) => !v);
                }}
              >
                🐞
              </button>
            </div>
          </div>

          {/* CodeMirror host */}
          <div className="relative flex-1 overflow-y-auto bg-[#1e1e1e]">
            <CodeEditor
              currentFile={currentFile}
              onChange={handleCodeChange}
              onReady={(v) => (viewRef.current = v)}
            />
          </div>
        </div>

        {/* debugger pane */}
        {showDebugger && (
          <div className="flex flex-col w-[400px] border-l border-[#333] bg-[#252526]">
            {/* test list */}
            <div className="h-[300px] border-b border-[#333] overflow-hidden">
              {/* @ts-expect-error fix this type */}
              <TestList tests={suites} onSelect={setDebugSteps} />
            </div>

            {/* step debugger */}
            <div className="flex-1 overflow-hidden">
              {debugSteps ? (
                <DebuggerPanel
                  steps={debugSteps}
                  onStepSelect={handleStepSelect}
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

      {/* status bar */}
      <div
        className="flex h-[24px] text-xs px-6 w-full"
        style={{ background: status.color }}
      >
        <div className="flex flex-1 items-center gap-2 ml-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: status.color === "#007acc" ? "#3BB446" : status.color,
            }}
          />
          <span>{status.text}</span>
        </div>

        <div className="opacity-80 flex flex-1 items-center ">
          <span className="w-full text-center">{stats.time}</span>
        </div>

        <div className="flex flex-1 gap-4 items-center  justify-end mr-2">
          <span>
            TESTS:&nbsp;<span>{stats.passing}</span>/<span>{stats.total}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default WebContainerDebugger;
