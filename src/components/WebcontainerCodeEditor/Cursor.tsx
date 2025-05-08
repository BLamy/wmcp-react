import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorView, DecorationSet, Decoration } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import { useWebContainer } from "@/wmcp/hooks/useWebcontainer";
import { useFileOperations } from "@/wmcp/components";
import { MCPServerStatus, useMCPServer } from "@/wmcp/hooks/useMcpServer";
import type { ServerConfig } from "@/wmcp/lib/McpClientManager";
import { WebContainer } from "@webcontainer/api";
import { WebTerminal } from "@/wmcp/components";
import { ExplorerPane } from "./ExplorerPane";
import { TopBar } from "./TopBar";
import { TabBar } from "./TabBar";
import { CodeMirrorEditor, clearHighlight, addHighlight } from "./CodeMirror";
import { WebContainerAgent, WebContainerAgentHandle } from "./WebContainerAgent";
import { MpcServerMenu } from "../MpcServerMenu";
import { Sidebar } from "./Sidebar";
import { DebugStep } from "./Sidebar";
import DebuggerStyles from "./DebuggerStyles";
import "./debugger.css"; // Import the same CSS as DumbDebugger
/* ───────────── constants, WebTerminal ───────────── */
export const DEBOUNCE_MS = 500;

export const DEFAULT_SERVER_CONFIGS: Record<string, ServerConfig> = {
  memory: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    env: {},
  },
  filesystem: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/"],
    env: {},
  },
  "sequential-thinking": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    env: {},
  },
  everything: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything"],
    env: {},
  },
};

/* ───────────── util: flatten .timetravel JSON ─────────────────── */
export const flattenDebugSteps = (raw: Record<string, any>) => {
  const out: Record<string, DebugStep[]> = {};
  const visited = new WeakSet();
  const walk = (node: any, trail: string[], defaultFile?: string) => {
    if (!node || typeof node !== "object" || visited.has(node)) return;
    visited.add(node);
    for (const [k, v] of Object.entries(node)) {
      if (Array.isArray(v) && v.length && (v[0].file || v[0].line)) {
        out[[...trail, k].join(" / ")] = (v as DebugStep[]).map((step) => ({
          ...step,
          file: step.file ?? defaultFile!,
        }));
      } else if (v && typeof v === "object") {
        walk(v, [...trail, k], defaultFile);
      }
    }
  };
  for (const [specFile, suites] of Object.entries(raw)) {
    walk(suites, [specFile.replace(/\.[^/.]+$/, "")], specFile);
  }
  return out;
};

export function useCursor(
  initialServerConfigs: Record<string, ServerConfig> = DEFAULT_SERVER_CONFIGS
) {
  /* ───────────── WebContainer & FS ───────────── */
  const webContainer                          = useWebContainer();
  const { loadFile, saveFile }                = useFileOperations(webContainer);

  /* ───────────── Editor plumbing ───────────── */
  const cmViewRef             = useRef<EditorView | null>(null);
  const fileContentRef        = useRef<string>("");
  const saveTimers            = useRef<Record<string, NodeJS.Timeout>>({});
  const userEditingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* ───────────── Layout state ───────────── */
  const [openTabs,      setOpenTabs]      = useState<string[]>([]);
  const [activeTab,     setActiveTab]     = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [activePanels,  setActivePanels]  = useState({
    left: true,
    bottom: true,
    right: false,
    overlay: false,
  });

  /* editing flag (debugger yields when true) */
  const [isUserEditing, setIsUserEditing] = useState(false);
  const isUserEditingRef                  = useRef(false);
  useEffect(() => { isUserEditingRef.current = isUserEditing; }, [isUserEditing]);

  /* ───────────── Debugger state ───────────── */
  const [debugData,         setDebugData]         = useState<Record<string, DebugStep[]> | null>(null);
  const [parsedTests,       setParsedTests]       = useState<Record<string, DebugStep[]>>({});
  const [selectedDebugTest, setSelectedDebugTest] = useState<DebugStep[] | null>(null);
  const [debugStepIndex,    setDebugStepIndex]    = useState(0);
  const [testStatuses,      setTestStatuses]      = useState<Record<string, string>>({});
  const [isRunningTests,    setIsRunningTests]    = useState(false);

  /* ───────────── Git state ───────────── */
  const [gitLoading,     setGitLoading]     = useState(false);
  const [gitStatus,      setGitStatus]      = useState<{ isRepo: boolean; status: string }>({
    isRepo: false,
    status : "Git not initialized in this project",
  });
  const [commitMessage,  setCommitMessage]  = useState("");

  /* ───────────── Servers state ───────────── */
  const [availableServerConfigs, setAvailableServerConfigs] =
    useState<Record<string, ServerConfig>>(initialServerConfigs);

  const [activeServers, setActiveServers] =
    useState<Record<string, ServerConfig>>({});

  const [isMpcServerConfigOpen, setIsMpcServerConfigOpen] = useState(false);

  const { status: serverStatus }: { status: MCPServerStatus } = useMCPServer({
    mcpServers: activeServers,
  });

  /* ------------------------------------------------------------------ *
   * Helpers                                                            *
   * ------------------------------------------------------------------ */

  /** Debounced save */
  const scheduleDebouncedSave = useCallback(
    (path: string, content: string) => {
      clearTimeout(saveTimers.current[path]);
      saveTimers.current[path] = setTimeout(
        () => saveFile(path, content).catch(console.error),
        DEBOUNCE_MS,
      );
    },
    [saveFile],
  );

  /* Flush debounce timers on unmount */
  useEffect(() => () => {
    Object.values(saveTimers.current).forEach(clearTimeout);
  }, []);

  /** Toggle any panel */
  const togglePanel = useCallback(
    (panel: keyof typeof activePanels) =>
      setActivePanels((p) => ({ ...p, [panel]: !p[panel] })),
    [],
  );

  /** Helper for clearing debug highlights reliably */
  const clearDebugHighlights = useCallback(() => {
    console.log("Clearing debug highlights");
    const view = cmViewRef.current;
    if (!view) {
      console.log("No editor view available to clear highlights");
      return;
    }
    
    try {
      view.dispatch({ 
        effects: clearHighlight.of(null) 
      });
      console.log("Successfully cleared highlights");
    } catch (err) {
      console.error("Error clearing highlights:", err);
    }
  }, []);

  /** Helper for highlighting debug lines reliably */
  const highlightDebugLine = useCallback((line: number) => {
    console.log(`Attempting to highlight line ${line}`);
    const view = cmViewRef.current;
    if (!view) {
      console.error("No editor view available for highlighting");
      return;
    }
    
    try {
      const { doc } = view.state;
      
      // Make sure line number is valid
      if (line < 1) {
        console.warn(`Invalid line number: ${line}, using line 1 instead`);
        line = 1;
      }
      
      if (line > doc.lines) {
        console.warn(`Line ${line} exceeds document length of ${doc.lines}, using last line instead`);
        line = doc.lines;
      }
      
      // Get line info for the target line
      const lineInfo = doc.line(line);
      
      // Create the decoration (use mark to highlight text)
      const deco = Decoration.mark({ 
        attributes: { class: "cm-debugger-highlight" } 
      }).range(lineInfo.from, lineInfo.to);
      
      // Ensure the editor has focus
      view.focus();
      
      // Apply highlight decoration 
      view.dispatch({
        effects: [
          clearHighlight.of(null),              // remove previous highlight(s)
          addHighlight.of(Decoration.set([deco])) // add the new one
        ],
        selection: { anchor: lineInfo.from },
        scrollIntoView: true
      });
      
      // Focus again after transaction to ensure highlight is visible
      setTimeout(() => {
        if (view) view.focus();
      }, 10);
      
      console.log(`Successfully highlighted line ${line}`);
    } catch (err) {
      console.error(`Error highlighting line ${line}:`, err);
    }
  }, []);

  /** Open a file from explorer */
  const handleFileSelection = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return;
      const content               = await loadFile(paths[0]);
      fileContentRef.current      = content;
      setSelectedPaths(paths);
      setActiveTab(paths[0]);
      if (!openTabs.includes(paths[0])) setOpenTabs((t) => [...t, paths[0]]);
    },
    [loadFile, openTabs],
  );

  /** Switch between already‑open tabs */
  const handleTabClick = useCallback(
    async (path: string) => {
      if (activeTab === path) return;

      if (selectedPaths[0]) {
        await saveFile(selectedPaths[0], fileContentRef.current).catch(console.error);
      }

      const content          = await loadFile(path);
      fileContentRef.current = content;

      setSelectedPaths([path]);
      setActiveTab(path);
      if (!openTabs.includes(path)) setOpenTabs((t) => [...t, path]);
    },
    [activeTab, selectedPaths, openTabs, loadFile, saveFile],
  );

  /* ───────────── Git helpers ───────────── */

  /** git status (auto‑detect repo) */
  const runGitStatus = useCallback(async () => {
    if (!webContainer) return;
    setGitLoading(true);

    try {
      const proc   = await webContainer.spawn("git", ["status"]);
      const code   = await proc.exit;

      if (code === 0) {
        setGitStatus({ isRepo: true, status: "Git repository initialized." });
      } else {
        setGitStatus({ isRepo: false, status: "Git repo seems corrupted." });
      }
    } catch {
      setGitStatus({ isRepo: false, status: "Git not initialized in this project" });
    } finally {
      setGitLoading(false);
    }
  }, [webContainer]);

  /** init repo */
  const initGitRepo = useCallback(async () => {
    if (!webContainer) return;
    setGitLoading(true);
    try {
      const proc = await webContainer.spawn("git", ["init"]);
      await proc.exit;
      setGitStatus({ isRepo: true, status: "Repo initialized (empty)" });
    } catch (err) {
      setGitStatus({ isRepo: false, status: String(err) });
    } finally {
      setGitLoading(false);
    }
  }, [webContainer]);

  /* ───────────── Testing / debugger helpers ───────────── */

  /** Scan .timetravel folder & coverage to build debugger data */
  const initDebugData = useCallback(async () => {
    if (!webContainer) return;

    try {
      // Check if the directory exists or create it
      try {
        await webContainer.fs.readdir("/.timetravel");
      } catch (err) {
        await webContainer.fs.mkdir("/.timetravel", { recursive: true });
      }

      // Simplify: Read all JSON files directly from the .timetravel directory and subdirectories
      const allSteps: Record<string, DebugStep[]> = {};
      
      // Read all subdirectories in .timetravel
      const allDirs = await webContainer.fs.readdir("/.timetravel", { withFileTypes: true });
      
      // Process each test directory
      for (const entry of allDirs) {
        if (!entry.isDirectory()) continue;
        
        // Skip UnknownTest directories
        if (entry.name.toLowerCase().includes("unknowntest")) {
          console.log(`Filtering out test directory: ${entry.name}`);
          continue;
        }
        
        const testName = entry.name;
        const testDir = `/.timetravel/${testName}`;
        
        // Read all files in this test directory
        try {
          const files = await webContainer.fs.readdir(testDir, { withFileTypes: true });
          const steps: DebugStep[] = [];
          
          // Process each JSON file
          for (const file of files) {
            if (!file.isFile()) continue;
            
            // Read and parse the file
            try {
              const content = await webContainer.fs.readFile(`${testDir}/${file.name}`, 'utf-8');
              const data = JSON.parse(content);
              
              if (data.file && data.line) {
                steps.push({
                  file: data.file.split('/').pop() || data.file,
                  line: data.line,
                  vars: data.vars || {},
                  stepNumber: data.stepNumber
                });
              }
            } catch (err) {
              console.error(`Error reading step file ${file.name}:`, err);
            }
          }
          
          // Sort steps by stepNumber if available
          steps.sort((a: any, b: any) => {
            const aStep = a.stepNumber !== undefined ? a.stepNumber : 0;
            const bStep = b.stepNumber !== undefined ? b.stepNumber : 0;
            return aStep - bStep;
          });
          
          if (steps.length > 0) {
            // Group by file name to organize tests
            const fileName = steps[0].file;
            if (!allSteps[fileName]) {
              allSteps[fileName] = [];
            }
            allSteps[testName] = steps;
          }
        } catch (err) {
          console.error(`Error processing test directory ${testName}:`, err);
        }
      }
      
      // Update state with the parsed data
      setDebugData(allSteps);
      setParsedTests(allSteps);
      
      // Select the first test if available and no test is currently selected
      if (!selectedDebugTest && Object.keys(allSteps).length > 0) {
        const firstTestKey = Object.keys(allSteps)[0];
        setSelectedDebugTest(allSteps[firstTestKey]);
        setDebugStepIndex(0);
      }
    } catch (err) {
      console.error("Error loading debug data:", err);
    }
  }, [webContainer, selectedDebugTest, setSelectedDebugTest, setDebugStepIndex]);

  /** run npm test inside container */
  const runTests = useCallback(async (specificTest?: string, event?: any) => {
    if (!webContainer) return;
    
    setIsRunningTests(true);

    try {
      // Ensure .timetravel directory exists
      await webContainer.fs.mkdir("/.timetravel", { recursive: true }).catch(() => {});
      
      // Prepare test command with optional specific test
      const args = ["test"];
      if (specificTest) args.push(specificTest);
      
      // Run tests - don't pass any event objects to spawn
      const proc = await webContainer.spawn("npm", args);
      
      // Capture output for debugging
      let output = "";
      proc.output.pipeTo(
        new WritableStream({
          write(data) { output += data; }
        })
      );
      
      await proc.exit;
      console.log("Tests completed, refreshing debug data");
    } catch (err) {
      console.error("Error running tests:", err);
    } finally {
      setIsRunningTests(false);
      // Refresh debug data
      await initDebugData();
    }
  }, [webContainer, initDebugData]);

  // Add an effect to handle debug step changes
  useEffect(() => {
    console.log("Debug step effect: step=", debugStepIndex, "test=", selectedDebugTest?.length);
    
    // Exit early if user is editing (debugger should yield)
    if (isUserEditingRef.current) {
      console.log("User is editing, not highlighting");
      return;
    }

    // Only proceed if we have a selected debug test and a valid step index
    if (!selectedDebugTest || !selectedDebugTest.length || debugStepIndex < 0 || debugStepIndex >= selectedDebugTest.length) {
      console.log("No valid test or step index, clearing highlights");
      clearDebugHighlights();
      return;
    }

    const currentStep = selectedDebugTest[debugStepIndex];
    if (!currentStep || !currentStep.file) {
      console.warn("Invalid debug step or missing file:", currentStep);
      clearDebugHighlights();
      return;
    }
    
    console.log("Processing debug step:", currentStep.file, "Line:", currentStep.line, "Active tab:", activeTab);
    
    // Handle file switching if needed
    if (activeTab !== currentStep.file) {
      console.log("Need to switch files from", activeTab, "to", currentStep.file);
      
      // Switch to the correct file, this will load content and update activeTab
      handleTabClick(currentStep.file).then(() => {
        // After file loads, highlight the line if user hasn't taken control
        if (!isUserEditingRef.current) {
          console.log("File loaded, highlighting line", currentStep.line);
          // Small delay to ensure editor is ready after file switch
          setTimeout(() => {
            if (isUserEditingRef.current) return;
            highlightDebugLine(currentStep.line);
          }, 100);
        }
      }).catch(err => {
        console.error("Error switching to file:", err);
      });
    } else {
      // We're already in the right file, just highlight immediately
      console.log("Already in correct file, highlighting line", currentStep.line);
      // No timeouts - directly apply the highlight
      highlightDebugLine(currentStep.line);
    }
  }, [
    debugStepIndex, 
    selectedDebugTest, 
    activeTab, 
    isUserEditingRef,
    handleTabClick,
    clearDebugHighlights,
    highlightDebugLine
  ]);

  /* ───────────── Server helpers ───────────── */

  const initializeMPCServer = useCallback(async (name: string) => {
    if (!webContainer) return;
    if (activeServers[name]) return;             // already active
    setActiveServers((s) => ({ ...s, [name]: availableServerConfigs[name] }));
  }, [webContainer, activeServers, availableServerConfigs]);

  const removeMPCServer = useCallback((name: string) => {
    setActiveServers((s) => {
      const copy = { ...s };
      delete copy[name];
      return copy;
    });
  }, []);

  const addCustomMPCServer = useCallback((name: string, cmd: string, args: string) => {
    const cfg: ServerConfig = { command: cmd, args: args.split(" "), env: {} };
    setAvailableServerConfigs((c) => ({ ...c, [name]: cfg }));
    setActiveServers((s) => ({ ...s, [name]: cfg }));
  }, []);

  /* ------------------------------------------------------------------ *
   * Hook return                                                        *
   * ------------------------------------------------------------------ */

  return {
    /* raw container helpers */
    webContainer,
    loadFile,
    saveFile,

    /* editor bundle */
    editor: {
      cmViewRef,
      fileContentRef,
      scheduleDebouncedSave,
      isUserEditingRef,
      setIsUserEditing,
      userEditingTimeoutRef,
    },

    /* UI / layout bundle */
    ui: {
      openTabs,
      setOpenTabs,
      activeTab,
      setActiveTab,
      selectedPaths,
      activePanels,
      setActivePanels,
      togglePanel,
      handleTabClick,
      handleFileSelection,
    },

    /* Debugger bundle */
    debugger: {
      debugData,
      setDebugData,
      parsedTests,
      setParsedTests,
      selectedDebugTest,
      setSelectedDebugTest,
      debugStepIndex,
      setDebugStepIndex,
      testStatuses,
      setTestStatuses,
      isRunningTests,
      setIsRunningTests,
      initDebugData,
      runTests,
      highlightDebugLine,
      clearDebugHighlights,
    },

    /* Git bundle */
    git: {
      gitLoading,
      gitStatus,
      commitMessage,
      setCommitMessage,
      runGitStatus,
      initGitRepo,
    },

    /* MCP / servers bundle */
    servers: {
      serverStatus,
      activeServers,
      setActiveServers,
      availableServerConfigs,
      setAvailableServerConfigs,
      initializeMPCServer,
      removeMPCServer,
      addCustomMPCServer,
      isMpcServerConfigOpen,
      setIsMpcServerConfigOpen,
    },
  };
}
export interface TerminalPanelProps {
  toggle: () => void;
  webContainer: WebContainer | null;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ toggle, webContainer }) => {
  const onInit   = () => console.log("Terminal ready");
  const onError  = (err: any) => console.error("Terminal error:", err);

  return (
    <div className="h-64 bg-[#1e1e1e] border-t border-[#252526]">
      <div className="bg-[#252526] h-6 flex items-center justify-between text-xs px-4">
        <span>TERMINAL</span>
        <button className="p-1 hover:bg-[#3c3c3c] rounded" onClick={toggle}>
          <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>  
      <WebTerminal
        webContainer={webContainer}
        height="calc(100% - 24px)"
        initialCommands={['echo "Welcome to WebContainer Terminal"']}
        onInitialized={onInit}
        onError={onError}
      />
    </div>
  );
};



export interface ChatPaneProps {
  apiKey?: string;
  onRequestApiKey?: () => void;
  activeServers:          Record<string, ServerConfig>;
  availableServerConfigs: Record<string, ServerConfig>;
  setActiveServers:       React.Dispatch<React.SetStateAction<Record<string, ServerConfig>>>;
  toggle: () => void;
}

const ChatPane: React.FC<ChatPaneProps> = ({
  apiKey, onRequestApiKey,
  activeServers, availableServerConfigs, setActiveServers,
  toggle,
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const agentRef = useRef<WebContainerAgentHandle>(null);

  return (
    <div className="w-96 bg-[#1e1e1e] border-l border-[#252526] flex flex-col">
      <div className="h-9 bg-[#252526] flex items-center justify-between px-4 text-sm">
        <span className="font-medium">AI Assistant</span>
        <div className="flex gap-2">
          <button title="New chat"
                  className="text-gray-400 hover:text-white"
                  onClick={() => agentRef.current?.handleClearMessages()}>
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white" onClick={toggle}>
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <WebContainerAgent
          ref={agentRef}
          messages={messages}
          setMessages={setMessages}
          apiKey={apiKey}
          onRequestApiKey={onRequestApiKey}
          activeServers={activeServers}
          serverConfigs={availableServerConfigs}
          setActiveServers={setActiveServers}
        />
      </div>
    </div>
  );
};



export interface CursorProps {
  apiKey?: string;
  onRequestApiKey?: () => void;
}

/* ------------------------------------------------------------------ *
 * Cursor                                                             *
 * ------------------------------------------------------------------ */
export const Cursor: FC<CursorProps> = ({ apiKey, onRequestApiKey }) => {
  /* pull all logic/state from the custom hook */
  const {
    /* webcontainer (needed by children) */
    webContainer,

    /* layout */
    ui: {
      openTabs, setOpenTabs,
      activeTab,  setActiveTab,
      selectedPaths,
      activePanels, togglePanel,
      handleTabClick, handleFileSelection,
    },

    /* editor bits */
    editor: {
      cmViewRef, fileContentRef,
      scheduleDebouncedSave,
      isUserEditingRef, setIsUserEditing,
      userEditingTimeoutRef,
    },

    /* debugger stuff */
    debugger: {
      debugData, parsedTests,
      selectedDebugTest, setSelectedDebugTest,
      debugStepIndex,    setDebugStepIndex,
      testStatuses,
      isRunningTests,
      initDebugData, runTests,
      highlightDebugLine,
      clearDebugHighlights,
    },

    /* git / source‑control */
    git: {
      gitLoading, gitStatus,
      commitMessage, setCommitMessage,
      runGitStatus,  initGitRepo,
    },

    /* server / MCP */
    servers: {
      serverStatus,
      activeServers,          setActiveServers,
      availableServerConfigs, setAvailableServerConfigs,
      initializeMPCServer,
      removeMPCServer,
      addCustomMPCServer,
      isMpcServerConfigOpen,  setIsMpcServerConfigOpen,
    },
  } = useCursor();

  // Create a wrapper function for setActiveServers that properly handles React's setState
  const handleSetActiveServers = (newValue: React.SetStateAction<Record<string, ServerConfig>>) => {
    setActiveServers(newValue);
  };



  /* ------------------------------------------------------------------ *
   * render                                                             *
   * ------------------------------------------------------------------ */
  return (
    <div className="h-screen w-full flex flex-col bg-[#1e1e1e] text-white overflow-hidden">
      {/* Include enhanced debugger styles */}
      <DebuggerStyles />
      
      {/* ───── Top bar (title + quick‑toggle icons) ───── */}
      <TopBar activePanels={activePanels} togglePanel={togglePanel} />

      <div className="flex-1 flex overflow-hidden">

        {/* ───── LEFT SIDEBAR ───── */}
        {activePanels.left && (
          <Sidebar
            /* explorer */
            selectedPaths={selectedPaths}
            handleFileSelection={handleFileSelection}

            /* debugger  */
            debugData={debugData}
            parsedTests={parsedTests}
            selectedDebugTest={selectedDebugTest}
            setSelectedDebugTest={setSelectedDebugTest}
            debugStepIndex={debugStepIndex}
            setDebugStepIndex={setDebugStepIndex}
            testStatuses={testStatuses}
            isRunningTests={isRunningTests}
            runTests={runTests}
            initDebugData={initDebugData}
            clearDebugHighlights={clearDebugHighlights}

            /* git  */
            gitLoading={gitLoading}
            gitStatus={gitStatus}
            commitMessage={commitMessage}
            setCommitMessage={setCommitMessage}
            runGitStatus={runGitStatus}
            initGitRepo={initGitRepo}
            webContainer={webContainer}

            /* servers */
            activeServers={activeServers}
            availableServerConfigs={availableServerConfigs}
            serverStatus={serverStatus}
            initializeMPCServer={initializeMPCServer}
            removeMPCServer={removeMPCServer}
            addCustomMPCServer={addCustomMPCServer}
            isMpcServerConfigOpen={isMpcServerConfigOpen}
            setIsMpcServerConfigOpen={setIsMpcServerConfigOpen}
          />
        )}

        {/* ───── MAIN COLUMN (tabs + editor + terminal/debugger) ───── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">

          {/* tabs */}
          <TabBar
            openTabs={openTabs}
            activeTab={activeTab}
            onTabClick={handleTabClick}
            onCloseTab={(pathToClose) => {
              const newOpenTabs = openTabs.filter(p => p !== pathToClose);
              setOpenTabs(newOpenTabs);

              if (activeTab === pathToClose) {
                const nextActiveTabPath = newOpenTabs.length ? newOpenTabs[newOpenTabs.length - 1] : null;
                if (nextActiveTabPath) {
                  handleTabClick(nextActiveTabPath);
                } else {
                  setActiveTab(null);
                  if (fileContentRef) {
                    fileContentRef.current = "";
                  }
                }
              }
            }}
          />

          {/* editor */}
          <div className="flex-1 overflow-hidden">
            {selectedPaths.length ? (
              <CodeMirrorEditor
                key={selectedPaths[0]}
                path={selectedPaths[0]}
                initialContent={fileContentRef.current}
                isUserEditingRef={isUserEditingRef}
                setIsUserEditing={setIsUserEditing}
                userEditingTimeoutRef={userEditingTimeoutRef}
                onReady={(v:EditorView)=>{ cmViewRef.current=v; }}
                onChange={(doc)=>{
                  fileContentRef.current = doc;
                  scheduleDebouncedSave(selectedPaths[0], doc);
                }}
              />
            ) : (
              <EmptyHint/>
            )}
          </div>

          {/* terminal */}
          {activePanels.bottom && (
            <TerminalPanel
              webContainer={webContainer}
              toggle={()=>togglePanel("bottom")}
            />
          )}
        </div>

        {/* ───── CHAT PANEL ───── */}
        {activePanels.right && (
          <ChatPane
            apiKey={apiKey}
            onRequestApiKey={onRequestApiKey}
            activeServers={activeServers}
            availableServerConfigs={availableServerConfigs}
            setActiveServers={handleSetActiveServers}
            toggle={()=>togglePanel("right")}
          />
        )}
      </div>

      {/* ───── modal overlay: Add / edit server configs ───── */}
      <MpcServerMenu
        serverConfigs={availableServerConfigs}
        activeServers={activeServers}
        serverStatus={serverStatus}
        webContainerReady={!!webContainer}
        onSelectServer={initializeMPCServer}
        onRemoveServer={removeMPCServer}
        onAddCustomServer={addCustomMPCServer}
        isOpen={isMpcServerConfigOpen}
        onOpenChange={setIsMpcServerConfigOpen}
      />
    </div>
  );
};

export default Cursor;

/* ---------- tiny placeholder when no file selected ---------- */
const EmptyHint = () => (
  <div className="h-full flex flex-col items-center justify-center text-gray-400">
    <p className="text-lg">Select a file from the explorer to start editing</p>
    <p className="text-sm mt-2">Or create a new file to begin</p>
  </div>
);