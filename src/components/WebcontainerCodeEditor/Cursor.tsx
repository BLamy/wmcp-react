import React from "react";
import {
  WebContainerAgent,
  WebContainerAgentHandle,
} from "./WebContainerAgent";
import { useWebContainer } from "@/wmcp/hooks/useWebcontainer";
import { useState, useEffect, useRef, FC } from "react";
import {
  WebTerminal,
  FileSystemTree,
  useFileOperations,
  LoadingIndicator,
} from "@/wmcp/components";
import {
  ResizablePanel,
  ResizableHandle,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import "xterm/css/xterm.css";

// Import MCP related components and hooks
import { ServerConfig } from "../../wmcp/lib/McpClientManager";
import { useMCPServer } from "../../wmcp/hooks/useMcpServer";
import { MpcServerMenu } from "../../components/MpcServerMenu";

// Import CodeMirror and related utilities
import {
  EditorState,
  StateEffect,
  StateField,
  Extension,
  Compartment,
} from "@codemirror/state";
import {
  EditorView,
  Decoration,
  DecorationSet,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import { history, historyKeymap } from "@codemirror/commands";
import { foldGutter, foldKeymap } from "@codemirror/language";
import {
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

// Default MPC server configurations
const DEFAULT_SERVER_CONFIGS: Record<string, ServerConfig> = {
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

// CSS styles for CodeMirror
const codeMirrorStyles = `
.cm-editor {
  height: 100%;
  width: 100%;
}
.cm-scroller {
  overflow: auto;
}
.cm-content {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
}
.bg-blue-900\\/40 {
  background-color: rgba(30, 64, 175, 0.4);
}
`;

// Debugger types and helper functions
export interface DumbFileMap {
  [filename: string]: { file: { contents: string } };
}

export interface DebugStep {
  file: string;
  line: number; // 1‑based
  vars?: Record<string, unknown>;
  sourceCode?: string; // optional, purely informational
}

// CodeMirror highlight utilities
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

// Helper formatter for debugger variables
const formatVal = (v: unknown) => {
  if (v === undefined) return <span className="text-gray-500">undefined</span>;
  if (v === null) return <span className="text-blue-400">null</span>;
  if (typeof v === "boolean")
    return <span className="text-orange-400">{String(v)}</span>;
  if (typeof v === "number") return <span className="text-cyan-400">{v}</span>;
  if (typeof v === "string")
    return <span className="text-green-400">"{v}"</span>;
  return <span className="text-yellow-400">{JSON.stringify(v)}</span>;
};

// Function to flatten any-depth debugSteps
const flattenDebugSteps = (raw: Record<string, any>) => {
  const out: Record<string, DebugStep[]> = {};
  const visited = new WeakSet(); // Track visited objects to prevent circular recursion

  const walk = (node: any, trail: string[], defaultFile?: string) => {
    if (!node || typeof node !== "object") return; // Skip primitives
    if (visited.has(node)) return; // Skip already visited objects to prevent circular recursion
    visited.add(node);

    for (const [k, v] of Object.entries(node)) {
      if (Array.isArray(v)) {
        const key = [...trail, k].join(" / ");
        // Only process arrays that look like DebugStep[] (have file and line properties)
        if (v.length > 0 && (v[0].file || v[0].line)) {
          out[key] = (v as DebugStep[]).map((step) => ({
            ...step,
            file: step.file ?? defaultFile!,
          }));
        }
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
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

export const Cursor = ({
  apiKey,
  onRequestApiKey,
}: {
  apiKey?: string;
  onRequestApiKey?: () => void;
}) => {
  const webContainer = useWebContainer();
  const [terminalMessage, setTerminalMessage] = useState<string>("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<string[]>(["/"]);
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activePanels, setActivePanels] = useState({
    left: true,
    bottom: true,
    right: false,
    overlay: false,
  });

  // Add active sidebar tab state
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "files" | "search" | "servers" | "source-control" | "test-debugger"
  >("files");

  // Add git status state
  const [gitStatus, setGitStatus] = useState<{
    isRepo: boolean;
    status: string;
  }>({
    isRepo: false,
    status: "",
  });
  const [gitLoading, setGitLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");

  // Add MPC server state
  const [activeServers, setActiveServers] = useState<
    Record<string, ServerConfig>
  >({});
  const [availableServerConfigs, setAvailableServerConfigs] = useState<
    Record<string, ServerConfig>
  >(DEFAULT_SERVER_CONFIGS);
  const [isMpcServerConfigOpen, setIsMpcServerConfigOpen] = useState(false);
  const [webContainerReady, setWebContainerReady] = useState(false);

  // Initialize MPC server connection
  const {
    status: serverStatus,
    tools: mcpTools,
    prompts: availablePrompts,
    resources: availableResources,
    executeTool,
    toolToServerMap,
  } = useMCPServer({
    mcpServers: activeServers,
  });

  // Add editorRefreshKey state
  const [editorRefreshKey, setEditorRefreshKey] = useState(0);

  const {
    buildFileTree,
    loadFile,
    saveFile,
    error,
    isLoading: isFileOpLoading,
  } = useFileOperations(webContainer);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const webContainerAgentRef = useRef<WebContainerAgentHandle>(null);
  const [parsedTests, setParsedTests] = useState<Record<string, DebugStep[]>>(
    {}
  );
  const [selectedDebugTest, setSelectedDebugTest] = useState<
    DebugStep[] | null
  >(null);
  const [debugStepIndex, setDebugStepIndex] = useState(0);
  const cmViewRef = useRef<EditorView | null>(null);

  // Add useEffect to track WebContainer readiness
  useEffect(() => {
    if (webContainer) {
      setWebContainerReady(true);
      console.log("WebContainer is available for MPC servers");
    } else {
      console.warn(
        "WebContainer is not available yet, MPC servers cannot start"
      );
    }
  }, [webContainer]);

  // Run git status when WebContainer is ready
  const runGitStatus = async () => {
    if (!webContainer) return;

    setGitLoading(true);

    try {
      // Try to run git status directly and catch the error if git is not initialized
      const gitProcess = await webContainer.spawn("git", ["status"]);

      // Wait for process to exit
      const exitCode = await gitProcess.exit;

      if (exitCode === 0) {
        // Successfully ran git status, the repository exists
        // Can't easily get output, so let's run status again with a different command
        try {
          // Run git status in a way we can capture the output
          const gitListProcess = await webContainer.spawn("git", [
            "ls-files",
            "--stage",
          ]);
          await gitListProcess.exit;

          // Run another command to get modified/untracked files
          const gitStatusShortProcess = await webContainer.spawn("git", [
            "status",
            "--short",
          ]);
          await gitStatusShortProcess.exit;

          setGitStatus({
            isRepo: true,
            status: `Git repository initialized.\nUse 'git add .' to stage all files and 'git commit -m "message"' to commit changes.`,
          });
        } catch (err) {
          setGitStatus({
            isRepo: true,
            status:
              "Git repository initialized. Check terminal for detailed status.",
          });
        }
      } else {
        // Git status command failed for some reason
        setGitStatus({
          isRepo: false,
          status: "Error running git status. The repository may be corrupted.",
        });
      }
    } catch (error) {
      // Most likely error is that git is not installed or repo not initialized
      console.error("Error running git status:", error);
      setGitStatus({
        isRepo: false,
        status: "Git not initialized in this project",
      });
    } finally {
      setGitLoading(false);
    }
  };

  // Run git status when WebContainer is ready
  useEffect(() => {
    if (webContainerReady && activeSidebarTab === "source-control") {
      runGitStatus();
    }
  }, [webContainerReady, activeSidebarTab]);

  // Debugger helper functions
  const clearDebugHighlights = () => {
    if (cmViewRef.current) {
      cmViewRef.current.dispatch({ effects: clearHighlight.of(null) });
    }
  };

  const highlightDebugLine = (line: number) => {
    const view = cmViewRef.current;
    if (!view) return;
    const { doc } = view.state;
    if (line < 1 || line > doc.lines) return;

    const info = doc.line(line);
    const deco = Decoration.set([
      Decoration.mark({ attributes: { class: "bg-blue-900/40" } }).range(
        info.from,
        info.to
      ),
    ]);
    view.dispatch({
      effects: [addHighlight.of(deco)],
      selection: { anchor: info.from },
      scrollIntoView: true,
    });
  };

  const handleDebugTestSelect = async (steps: DebugStep[]) => {
    const paths = steps.map((step) => step.file);
    setSelectedDebugTest(steps);
    setDebugStepIndex(0); // Reset to first step

    // Clear previous highlights
    clearDebugHighlights();

    // Load the file for the first step
    if (paths.length > 0 && steps[0]) {
      const firstStep = steps[0];
      const firstFilePath = firstStep.file;

      try {
        console.log("Loading file for first debug step:", firstFilePath);
        const content = await loadFile(firstFilePath);
        setFileContent(content);
        setActiveTab(firstFilePath);
        if (!openTabs.includes(firstFilePath)) {
          setOpenTabs([...openTabs, firstFilePath]);
        }

        // Highlight the first line after a short delay to allow editor update
        // We need to wait for the editor to potentially update its content/path
        setTimeout(() => {
          highlightDebugLine(firstStep.line);
        }, 100);
      } catch (err) {
        console.error(`Error loading file ${firstFilePath}:`, err);
      }
    } else {
      // No steps or path, clear editor if needed
      // setActiveTab(null);
      // setFileContent("");
    }
  };

  // Effect to handle debug step changes
  useEffect(() => {
    if (selectedDebugTest && selectedDebugTest.length > debugStepIndex) {
      const currentStep = selectedDebugTest[debugStepIndex];
      const currentFile = currentStep.file;

      // Check if the file for the current step is already open
      if (activeTab !== currentFile) {
        // If not, load the correct file first
        handleTabClick(currentFile).then(() => {
          // Highlight after the file load is complete
          // Use a small delay to ensure editor view updates
          setTimeout(() => highlightDebugLine(currentStep.line), 100);
        });
      } else {
        // File is already open, just highlight the line
        highlightDebugLine(currentStep.line);
      }
    } else {
      // No test selected or index out of bounds, clear highlights
      clearDebugHighlights();
    }
  }, [debugStepIndex, selectedDebugTest, activeTab]); // Dependencies: step index, selected test, active tab

  // Initialize debug data
  const initDebugData = async () => {
    if (!webContainer) {
      console.error("Cannot load debug data: WebContainer is not available");
      setTerminalMessage("WebContainer not ready");
      setParsedTests({});
      return;
    }

    setTerminalMessage("Looking for test debug data...");
    setLoading(true);
    let foundTimetravelPath: string | null = null;
    let foundValidData = false;
    const debugStepsData: Record<string, Record<string, any>> = {};

    try {
      // Try different possible paths for the timetravel directory

      const path = "./.timetravel";
      try {
        const dirs = await webContainer.fs.readdir(path, {
          withFileTypes: true,
        });
        if (dirs.length > 0) {
          console.log(`Found ${path} directory with ${dirs.length} items`);
          foundTimetravelPath = path;

          // Recursive function to find leaf directories (containing only files)
          const findLeafDirs = async (dirPath: string): Promise<string[]> => {
            const entries = await webContainer.fs.readdir(dirPath, {
              withFileTypes: true,
            });

            const subdirs = entries.filter((entry: any) => entry.isDirectory());

            // If no subdirectories, this is a leaf directory
            if (subdirs.length === 0) {
              return [dirPath];
            }

            // Otherwise, recursively check all subdirectories
            const results: string[] = [];
            for (const dir of subdirs) {
              const subpath = `${dirPath}/${dir.name}`;
              const leafDirs = await findLeafDirs(subpath);
              results.push(...leafDirs);
            }

            return results.filter(
              (dir: string) => !dir.includes("UnknownTest")
            );
          };

          // Find all leaf directories and process them
          const leafDirs = await findLeafDirs(path);
          const testNames = leafDirs.map((dir) => dir.split("/").pop()!);
          const unsortedDebugSteps = testNames.reduce((acc, testName) => {
            acc[testName] = [];
            return acc;
          }, {} as Record<string, any>);

          // Process each leaf directory
          for (const leafDir of leafDirs) {
            // Process files in the leaf directory
            const files = await webContainer.fs.readdir(leafDir, {
              withFileTypes: true,
            });

            // Read all files in the leaf directory
            for (const file of files) {
              try {
                const filePath = `${leafDir}/${file.name}`;
                const testName = leafDir.split("/").pop()!;
                const content = await webContainer.fs.readFile(
                  filePath,
                  "utf-8"
                );
                try {
                  const jsonData = JSON.parse(content as string);
                  unsortedDebugSteps[testName].push(jsonData);
                } catch (parseErr) {
                  console.warn(
                    `Could not parse ${file.name} as JSON:`,
                    parseErr
                  );
                }
              } catch (readErr) {
                console.error(`Failed to read file ${file.name}:`, readErr);
              }
            }
          }

          // Group debug steps by file
          const groupedDebugSteps = Object.entries(unsortedDebugSteps).reduce(
            (acc, [testName, steps]) => {
              const sortedSteps = (steps as any[])
                .sort((a: any, b: any) => {
                  const stepA = a.stepNumber !== undefined ? a.stepNumber : 0;
                  const stepB = b.stepNumber !== undefined ? b.stepNumber : 0;
                  return stepA - stepB;
                })
                .map((step: any) => ({
                  ...step,
                  file: step.file.split("/").pop()!,
                }));

              const fileName = sortedSteps[sortedSteps.length - 1]?.file;
              if (fileName) {
                if (!acc[fileName]) {
                  acc[fileName] = {};
                }
                acc[fileName][testName] = sortedSteps;
              }
              return acc;
            },
            {} as Record<string, Record<string, any>>
          );

          Object.assign(debugStepsData, groupedDebugSteps);
          foundValidData = Object.keys(debugStepsData).length > 0;
        }
      } catch (error) {
        // Directory not found, continue checking
      }

      if (!foundTimetravelPath) {
        console.log("No timetravel directory found.");
        setTerminalMessage("No timetravel directory found. Try running tests.");
        setParsedTests({});
        return;
      }

      // Convert the grouped debug steps to the format expected by DumbDebugger
      const allParsedTests = flattenDebugSteps(debugStepsData);

      setParsedTests(allParsedTests);

      if (foundValidData) {
        setTerminalMessage(
          `Loaded debug data for ${
            Object.keys(debugStepsData).length
          } files with ${Object.keys(allParsedTests).length} test suites.`
        );
      } else {
        setTerminalMessage(
          "Timetravel directory found, but no valid debug data parsed."
        );
      }
    } catch (error) {
      console.error("Error during debug data initialization:", error);
      setTerminalMessage(`Error loading debug data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Run tests to generate timetravel data
  const runTests = async () => {
    if (!webContainer) {
      console.error("Cannot run tests: WebContainer is not available");
      return;
    }

    setTerminalMessage("Running tests to generate debug data...");
    setParsedTests({}); // Clear previous results

    try {
      // Spawn the test process
      const testProcess = await webContainer.spawn("npm", ["test"]);

      let output = "";
      testProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            output += data;
            setTerminalMessage(`Running tests...\n${output}`);
          },
        })
      );

      const exitCode = await testProcess.exit;

      if (exitCode === 0) {
        setTerminalMessage(
          `Tests completed successfully!\n${output}\nLoading debug data...`
        );
        // Wait a moment for files to be written before loading
        setTimeout(initDebugData, 1000);
      } else {
        setTerminalMessage(`Tests failed (exit code ${exitCode}).\n${output}`);
      }
      initDebugData();
    } catch (error) {
      console.error("Error running tests:", error);
      setTerminalMessage(`Error running tests: ${error}`);
    } finally {
      // setIsRunningTests(false);
    }
  };

  // Initial load or when tab becomes active
  useEffect(() => {
    if (webContainerReady && activeSidebarTab === "test-debugger") {
      initDebugData();
    }
  }, [webContainerReady, activeSidebarTab]);

  // Add event handler for sidebar tab change
  const handleSidebarTabChange = (
    tab: "files" | "search" | "servers" | "source-control" | "test-debugger"
  ) => {
    setActiveSidebarTab(tab);
    if (tab === "source-control" && webContainerReady) {
      runGitStatus();
    } else if (tab === "test-debugger") {
      initDebugData();
    }
  };

  // Toggle panel visibility
  const togglePanel = (panel: "left" | "bottom" | "right" | "overlay") => {
    setActivePanels((prev) => ({
      ...prev,
      [panel]: !prev[panel],
    }));
  };

  // Sample commands for the command palette
  const commands = [
    { id: "new-file", name: "New File", shortcut: "⌘N", icon: "file-plus" },
    { id: "open-file", name: "Open File", shortcut: "⌘O", icon: "folder-open" },
    { id: "save-file", name: "Save File", shortcut: "⌘S", icon: "save" },
    {
      id: "run-terminal",
      name: "Run in Terminal",
      shortcut: "⌘⏎",
      icon: "terminal",
    },
    {
      id: "toggle-terminal",
      name: "Toggle Terminal",
      shortcut: "⌃`",
      icon: "terminal",
    },
    {
      id: "toggle-chat",
      name: "Toggle AI Chat",
      shortcut: "⌘J",
      icon: "message-square",
    },
    {
      id: "search-code",
      name: "Search in Code",
      shortcut: "⌘F",
      icon: "search",
    },
    {
      id: "search-all",
      name: "Search All Files",
      shortcut: "⌘⇧F",
      icon: "search",
    },
  ];

  // Filter commands based on search query
  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle command execution
  const executeCommand = (commandId: string) => {
    switch (commandId) {
      case "toggle-chat":
        togglePanel("right");
        break;
      case "toggle-terminal":
        togglePanel("bottom");
        break;
      case "save-file":
        handleSaveFile();
        break;
      // Add other command handlers as needed
      default:
        console.log(`Command executed: ${commandId}`);
    }
    setCmdkOpen(false);
  };

  // Key handlers for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open command palette with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdkOpen(true);
        setTimeout(() => searchRef.current?.focus(), 10);
      }

      // Close command palette with Escape
      if (e.key === "Escape" && cmdkOpen) {
        setCmdkOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cmdkOpen]);

  useEffect(() => {
    if (webContainer) {
      refreshFiles();
    }
  }, [webContainer]);

  const refreshFiles = async (isManualRefresh = false) => {
    if (!isManualRefresh) {
      setLoading(true);
    }
    try {
      const tree = await buildFileTree();
      setFileTree(tree);
      if (!expandedPaths.includes("/")) {
        setExpandedPaths(["/"]);
      }
    } catch (err) {
      console.error("Error building file tree:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelection = async (paths: string[]) => {
    setSelectedPaths(paths);
    if (paths.length > 0) {
      try {
        console.log("Loading file", paths[0]);
        const content = await loadFile(paths[0]);
        setFileContent(content);
        setActiveTab(paths[0]);
        if (!openTabs.includes(paths[0])) {
          setOpenTabs([...openTabs, paths[0]]);
        }
      } catch (err) {
        console.error(`Error loading file ${paths[0]}:`, err);
      }
    }
  };

  // Helper to normalize file paths for comparison
  const normalizePath = (path: string) => {
    // Remove leading slash if present and standardize path separators
    return path.replace(/^\/+/, "").replace(/\\/g, "/");
  };

  // Monitor messages for file operation tool results
  useEffect(() => {
    // Only proceed if there are messages
    if (messages.length > 0) {
      // Get the last message
      const lastMessage = messages[messages.length - 1];

      // Check if it's a tool result
      if (lastMessage && lastMessage.type === "tool_result") {
        // Find the corresponding tool call to get the tool name
        const toolCallMessage = messages.find(
          (msg) =>
            msg.type === "tool_call" &&
            msg.toolCall &&
            msg.toolCall.id === lastMessage.toolCallId
        );

        if (toolCallMessage && toolCallMessage.type === "tool_call") {
          const toolName = toolCallMessage.toolCall.name;

          // If this is a file operation tool
          if (toolName === "edit_file" || toolName === "create_file") {
            console.log(`File operation (${toolName}) detected`);

            // Get the file path from the tool call arguments
            const filePath = toolCallMessage.toolCall.arguments.file_path || "";

            // Always refresh the file tree
            refreshFiles(false);

            // Get normalized paths for comparison
            const normalizedFilePath = normalizePath(filePath);
            const normalizedOpenPath =
              selectedPaths.length > 0 ? normalizePath(selectedPaths[0]) : "";

            // Refresh in any of these cases:
            // 1. The edited file matches the currently open file
            // 2. The edited file is a parent directory of the open file
            // 3. The edited file has the same base name as the open file (might be in different directory)
            if (selectedPaths.length > 0 && activeTab) {
              const openFileName = selectedPaths[0].split("/").pop() || "";
              const editedFileName = filePath.split("/").pop() || "";

              if (
                normalizedFilePath === normalizedOpenPath ||
                normalizedOpenPath.startsWith(normalizedFilePath + "/") ||
                openFileName === editedFileName
              ) {
                console.log(
                  `Refreshing editor because ${filePath} affects ${selectedPaths[0]}`
                );
                //   refreshMonacoEditor();
              }
            }
          }
        }
      }
    }
  }, [messages]);

  // Update handleTabClick to refresh editor when switching tabs
  const handleTabClick = async (tabPath: string) => {
    setActiveTab(tabPath);
    try {
      const content = await loadFile(tabPath);
      setFileContent(content);
      setSelectedPaths([tabPath]);
      // Refresh editor layout after content is loaded
      setEditorRefreshKey((prevKey) => prevKey + 1);
    } catch (err) {
      console.error(`Error loading file ${tabPath}:`, err);
    }
  };

  const handleCloseTab = (tabPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter((path) => path !== tabPath);
    setOpenTabs(newTabs);

    if (activeTab === tabPath) {
      if (newTabs.length > 0) {
        handleTabClick(newTabs[newTabs.length - 1]);
      } else {
        setActiveTab(null);
        setFileContent("");
        setSelectedPaths([]);
      }
    }
  };

  // Update handleSaveFile to use the delayed refresh
  const handleSaveFile = async () => {
    if (selectedPaths.length > 0) {
      try {
        // Save the file
        await saveFile(selectedPaths[0], fileContent);

        // Refresh with a slight delay to ensure file is written
        //   refreshMonacoEditor(300);
      } catch (err) {
        console.error(`Error saving file ${selectedPaths[0]}:`, err);
      }
    }
  };

  const handleTerminalInitialized = () => {
    setTerminalMessage("Terminal ready");
  };

  const handleTerminalError = (error: any) => {
    setTerminalMessage(`Error: ${error.message || String(error)}`);
  };

  // Add a function to properly initialize MPC server
  const initializeMPCServer = async (serverName: string) => {
    if (!webContainer) {
      console.error(
        "Cannot activate MPC server: WebContainer is not available"
      );
      alert(
        "WebContainer is not available. Please refresh the page and try again."
      );
      return;
    }

    try {
      console.log(`Attempting to initialize MPC server: ${serverName}`);

      // Check if the server is already active
      if (activeServers[serverName]) {
        console.log(`MPC Server "${serverName}" is already active.`);
        return;
      }

      // Add the selected server to existing active servers
      const updatedServers = {
        ...activeServers,
        [serverName]: availableServerConfigs[serverName],
      };

      // Wait a moment to ensure WebContainer is ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Set the active servers
      setActiveServers(updatedServers);

      // Log success attempt
      console.log(
        `MPC Server "${serverName}" activation initiated. Check console for status updates.`
      );
    } catch (error) {
      console.error("Error initializing MPC server:", error);
      alert(
        `Failed to initialize ${serverName} server. See console for details.`
      );
    }
  };

  // Add a function to remove a specific MPC server
  const removeMPCServer = (serverName: string) => {
    if (!activeServers[serverName]) {
      console.log(`MPC Server "${serverName}" is not active.`);
      return;
    }

    console.log(`Removing MPC server: ${serverName}`);

    // Create a copy of active servers without the one to be removed
    const updatedServers = { ...activeServers };
    delete updatedServers[serverName];

    // Update active servers
    setActiveServers(updatedServers);
  };

  // Add a function to create and add a custom MPC server
  const addCustomMPCServer = (name: string, command: string, args: string) => {
    if (!webContainer) {
      console.error(
        "Cannot create custom MPC server: WebContainer is not available"
      );
      alert(
        "WebContainer is not available. Please refresh the page and try again."
      );
      return;
    }

    console.log(`Creating custom MPC server: ${name}`);

    try {
      // Create a custom server config
      const customConfig: ServerConfig = {
        command: command,
        args: args.split(" "),
        env: {},
      };

      // Add to available configurations
      const updatedConfigs = {
        ...availableServerConfigs,
        [name]: customConfig,
      };

      // Update available configs
      setAvailableServerConfigs(updatedConfigs);
      console.log("Updated server configs:", updatedConfigs);

      // Add to active servers
      const updatedServers = {
        ...activeServers,
        [name]: customConfig,
      };

      // Update active servers (this will also activate the new server)
      setActiveServers(updatedServers);
    } catch (error) {
      console.error("Error creating custom MPC server:", error);
      alert(`Failed to create custom server: ${error}`);
    }
  };

  // Add useEffect hook to log server status changes
  useEffect(() => {
    if (serverStatus) {
      console.log("MPC Server status changed:", serverStatus);
    }

    // Add more detailed debugging for error state
    if (serverStatus === "ERROR") {
      console.error(
        "MPC Server initialization failed. Make sure the WebContainer is fully initialized."
      );
    }
  }, [serverStatus]);

  // Unified CodeMirror editor that supports both editing and debugging
  const CodeMirrorEditor: FC<{
    content: string;
    path: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    onReady?: (view: EditorView) => void;
  }> = ({ content, path, onChange, readOnly = false, onReady }) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const editorViewRef = useRef<EditorView | null>(null);
    const isReadOnlyRef = useRef(readOnly);
    const onChangeRef = useRef(onChange);

    // Keep refs updated
    useEffect(() => {
      isReadOnlyRef.current = readOnly;
    }, [readOnly]);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Determine language based on file extension
    const getLanguageExtension = (filePath: string): Extension => {
      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      switch (ext) {
        case "js":
        case "jsx":
        case "ts":
        case "tsx":
          return javascript();
        case "html":
        case "htm":
          return html();
        case "css":
          return css();
        case "json":
          return json();
        case "md":
          return markdown();
        default:
          return javascript(); // default to JavaScript
      }
    };

    // Add a compartment for language
    const languageCompartment = useRef(new Compartment());

    // Initialize CodeMirror View only once
    useEffect(() => {
      if (!hostRef.current || editorViewRef.current) return;

      const extensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
        ]),
        oneDark,
        highlightField, // For debugger highlights
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            onChangeRef.current &&
            !isReadOnlyRef.current
          ) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
        }),
        // Initial state determined by readOnly prop
        EditorView.editable.of(!isReadOnlyRef.current),
        !isReadOnlyRef.current ? closeBrackets() : [],
        languageCompartment.current.of(getLanguageExtension(path)), // Initial language
      ].flat(); // Flatten in case closeBrackets returns []

      const startState = EditorState.create({
        doc: content,
        extensions,
      });

      const view = new EditorView({
        state: startState,
        parent: hostRef.current,
      });

      editorViewRef.current = view;
      if (onReady) onReady(view);

      // Cleanup on unmount
      return () => {
        view.destroy();
        editorViewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array ensures this runs only once

    // Effect to update content when the prop changes
    useEffect(() => {
      const view = editorViewRef.current;
      if (view && content !== view.state.doc.toString()) {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: content || "",
          },
          // Optionally prevent selection reset on content change
          // selection: view.state.selection,
          // userEvent: 'setContent'
        });
      }
    }, [content]);

    // Effect to update readOnly status
    useEffect(() => {
      const view = editorViewRef.current;
      if (view) {
        //   view.dispatch({
        //     effects: EditorView.e)
        //   });
      }
    }, [readOnly]);

    // Effect to update language when path changes
    useEffect(() => {
      const view = editorViewRef.current;
      if (view) {
        view.dispatch({
          effects: languageCompartment.current.reconfigure(
            getLanguageExtension(path)
          ),
        });
      }
    }, [path]);

    return <div ref={hostRef} className="h-full w-full" />;
  };

  // Add CodeMirror styles to document
  useEffect(() => {
    // Add CodeMirror styles to document
    const styleElement = document.createElement("style");
    styleElement.textContent = codeMirrorStyles;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <div className="h-screen w-full bg-[#1e1e1e] text-white overflow-hidden flex flex-col">
      {/* Top bar - like Cursor */}
      <div className="h-9 bg-[#252526] flex items-center px-2 text-sm shadow-sm justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-gray-300 font-medium ml-2">
            WebContainer IDE
          </span>
        </div>

        {/* Command search bar */}
        <div className="relative flex-1 max-w-[40%]">
          <div
            className="flex items-center bg-[#3c3c3c] rounded h-6 px-2 cursor-pointer hover:bg-[#4c4c4c]"
            onClick={() => {
              setCmdkOpen(true);
              setTimeout(() => searchRef.current?.focus(), 10);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400 mr-2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-gray-400 text-xs flex-1">
              Search or run command
            </span>
            <span className="ml-4 text-xs bg-[#2a2a2a] rounded px-1 text-gray-400">
              ⌘K
            </span>
          </div>

          {/* Command Menu (CMDK) */}
          {cmdkOpen && (
            <>
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={() => setCmdkOpen(false)}
              />
              <div className="absolute top-8 left-0 w-[500px] bg-[#252526] border border-[#3c3c3c] rounded-md shadow-lg z-50 overflow-hidden">
                <div className="p-2 border-b border-[#3c3c3c]">
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type a command or search..."
                    className="w-full bg-[#3c3c3c] text-white border-0 rounded p-2 text-sm focus:ring-0 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {filteredCommands.length > 0 ? (
                    <div className="py-2">
                      {filteredCommands.map((cmd) => (
                        <div
                          key={cmd.id}
                          className="px-3 py-2 hover:bg-[#3c3c3c] flex items-center justify-between cursor-pointer text-sm"
                          onClick={() => executeCommand(cmd.id)}
                        >
                          <div className="flex items-center">
                            <span className="mr-2 text-blue-400">
                              {cmd.icon === "file-plus" && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="12" y1="18" x2="12" y2="12" />
                                  <line x1="9" y1="15" x2="15" y2="15" />
                                </svg>
                              )}
                              {cmd.icon === "folder-open" && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                              )}
                              {cmd.icon === "save" && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                  <polyline points="17 21 17 13 7 13 7 21" />
                                  <polyline points="7 3 7 8 15 8" />
                                </svg>
                              )}
                              {cmd.icon === "terminal" && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="4 17 10 11 4 5" />
                                  <line x1="12" y1="19" x2="20" y2="19" />
                                </svg>
                              )}
                              {cmd.icon === "message-square" && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                              )}
                              {cmd.icon === "search" && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="11" cy="11" r="8" />
                                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                              )}
                            </span>
                            <span>{cmd.name}</span>
                          </div>
                          <span className="text-gray-500 text-xs">
                            {cmd.shortcut}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No commands found
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {/* Action Icons in Top Right */}
        <div className="flex items-center space-x-1 mr-2">
          <button
            className={`p-1.5 rounded hover:bg-[#3c3c3c] focus:outline-none ${
              activePanels.left ? "text-white bg-[#3c3c3c]" : "text-gray-400"
            }`}
            onClick={() => togglePanel("left")}
            title="Toggle Explorer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          <button
            className={`p-1.5 rounded hover:bg-[#3c3c3c] focus:outline-none ${
              activePanels.bottom ? "text-white bg-[#3c3c3c]" : "text-gray-400"
            }`}
            onClick={() => togglePanel("bottom")}
            title="Toggle Terminal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </button>

          <button
            className={`p-1.5 rounded hover:bg-[#3c3c3c] focus:outline-none ${
              activePanels.right ? "text-white bg-[#3c3c3c]" : "text-gray-400"
            }`}
            onClick={() => togglePanel("right")}
            title="Toggle AI Assistant"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          <div className="mx-1 h-4 w-px bg-[#3c3c3c]"></div>

          <button
            className="p-1.5 rounded hover:bg-[#3c3c3c] focus:outline-none text-gray-400"
            title="Settings"
            onClick={() => togglePanel("overlay")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Explorer */}
        {activePanels.left && (
          <div className="w-60 bg-[#1e1e1e] border-r border-[#252526] flex flex-col overflow-hidden select-none">
            <div className="flex flex-col overflow-hidden bg-[#1e1e1e]">
              <div className="h-9 flex items-center select-none bg-[#252526]">
                <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-[#3c3c3c] scrollbar-track-transparent">
                  <div className="flex items-center space-x-1 px-2">
                    <button
                      className={`p-1.5 rounded ${
                        activeSidebarTab === "files"
                          ? "bg-[#3c3c3c] text-white"
                          : "hover:bg-[#3c3c3c] text-gray-400"
                      } focus:outline-none`}
                      title="Files"
                      onClick={() => handleSidebarTabChange("files")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </button>
                    {/* TODO: Implement sed and grep (using pglite?) for search */}
                    {/* <button 
                                  className={`p-1.5 rounded ${activeSidebarTab === 'search' ? 'bg-[#3c3c3c] text-white' : 'hover:bg-[#3c3c3c] text-gray-400'} focus:outline-none`}
                                  title="Search"
                                  onClick={() => handleSidebarTabChange('search')}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8"/>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                    </svg>
                                </button> */}

                    <button
                      className={`p-1.5 rounded ${
                        activeSidebarTab === "test-debugger"
                          ? "bg-[#3c3c3c] text-white"
                          : "hover:bg-[#3c3c3c] text-gray-400"
                      } focus:outline-none`}
                      title="Test Debugger"
                      onClick={() => handleSidebarTabChange("test-debugger")}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        stroke={"none"}
                        fill={"currentColor"}
                      >
                        <path d="M10.94 13.5l-1.32 1.32a3.73 3.73 0 00-7.24 0L1.06 13.5 0 14.56l1.72 1.72-.22.22V18H0v1.5h1.5v.08c.077.489.214.966.41 1.42L0 22.94 1.06 24l1.65-1.65A4.308 4.308 0 006 24a4.31 4.31 0 003.29-1.65L10.94 24 12 22.94 10.09 21c.198-.464.336-.951.41-1.45v-.1H12V18h-1.5v-1.5l-.22-.22L12 14.56l-1.06-1.06zM6 13.5a2.25 2.25 0 012.25 2.25h-4.5A2.25 2.25 0 016 13.5zm3 6a3.33 3.33 0 01-3 3 3.33 3.33 0 01-3-3v-2.25h6v2.25zm14.76-9.9v1.26L13.5 17.37V15.6l8.5-5.37L9 2v9.46a5.07 5.07 0 00-1.5-.72V.63L8.64 0l15.12 9.6z" />
                      </svg>
                    </button>

                    <button
                      className={`p-1.5 rounded ${
                        activeSidebarTab === "servers"
                          ? "bg-[#3c3c3c] text-white"
                          : "hover:bg-[#3c3c3c] text-gray-400"
                      } focus:outline-none`}
                      title="MCP Servers"
                      onClick={() => handleSidebarTabChange("servers")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="2"
                          y="2"
                          width="20"
                          height="8"
                          rx="2"
                          ry="2"
                        ></rect>
                        <rect
                          x="2"
                          y="14"
                          width="20"
                          height="8"
                          rx="2"
                          ry="2"
                        ></rect>
                        <line x1="6" y1="6" x2="6.01" y2="6"></line>
                        <line x1="6" y1="18" x2="6.01" y2="18"></line>
                      </svg>
                    </button>
                    <button
                      className={`p-1.5 rounded ${
                        activeSidebarTab === "source-control"
                          ? "bg-[#3c3c3c] text-white"
                          : "hover:bg-[#3c3c3c] text-gray-400"
                      } focus:outline-none`}
                      title="Source Control"
                      onClick={() => handleSidebarTabChange("source-control")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="18" cy="18" r="3" />
                        <circle cx="6" cy="6" r="3" />
                        <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                        <line x1="6" y1="9" x2="6" y2="21" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar content based on active tab */}
            {activeSidebarTab === "files" && (
              <>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 flex items-center justify-between bg-[#252526]">
                  <span>Explorer</span>
                  <div className="flex space-x-1">
                    <button
                      className="hover:bg-[#3c3c3c] rounded p-1 focus:outline-none"
                      onClick={() => refreshFiles(false)}
                      title="Refresh explorer"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                      </svg>
                    </button>
                    <button
                      className="hover:bg-[#3c3c3c] rounded p-1 focus:outline-none"
                      onClick={() => {}}
                      title="New file"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto py-1">
                  {loading ? (
                    <LoadingIndicator
                      message="Loading files..."
                      variant="spinner"
                      className="m-4"
                    />
                  ) : (
                    <div className="py-1">
                      <FileSystemTree
                        files={fileTree}
                        selectedPaths={selectedPaths}
                        expandedPaths={expandedPaths}
                        onSelectionChange={handleFileSelection}
                        onExpandedChange={setExpandedPaths}
                        refreshInterval={5000}
                        onRefresh={() => refreshFiles(true)}
                        showAutoRefreshIndicator={false}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {activeSidebarTab === "search" && (
              <div className="flex-1 flex flex-col">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 bg-[#252526]">
                  <span>Search</span>
                </div>
                <div className="p-4">
                  <input
                    type="text"
                    placeholder="Search in files"
                    className="w-full bg-[#3c3c3c] text-white border-0 rounded p-2 text-sm focus:ring-0 focus:outline-none"
                  />
                  <div className="mt-6 text-center text-gray-500 text-sm">
                    Type to search in files
                  </div>
                </div>
              </div>
            )}

            {activeSidebarTab === "test-debugger" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 bg-[#252526] flex justify-between">
                  <span>Test Debugger</span>
                  <div className="flex items-center space-x-2">
                    <button
                      className="p-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={runTests}
                      title="Run Tests"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 3l14 9-14 9V3z"></path>
                      </svg>
                    </button>
                    <button
                      className="p-1 text-gray-400 hover:text-white"
                      onClick={initDebugData}
                      title="Refresh"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M23 4v6h-6"></path>
                        <path d="M1 20v-6h6"></path>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                        <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <ResizablePanelGroup
                  direction="vertical"
                  className="flex-1 overflow-hidden"
                >
                  {/* Test picker panel */}
                  <ResizablePanel defaultSize={40} minSize={20}>
                    <div className="h-full overflow-y-auto py-2">
                      {Object.keys(parsedTests).length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          <p className="mb-4">
                            No tests with debug data available
                          </p>
                          <button
                            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={runTests}
                          >
                            Run Tests
                          </button>
                        </div>
                      ) : (
                        <ul>
                          {Object.entries(parsedTests).map(([name, steps]) => (
                            <li
                              key={name}
                              className={`px-4 py-2 hover:bg-[#2a2d2e] cursor-pointer flex justify-between ${
                                selectedDebugTest === steps
                                  ? "bg-[#37373d]"
                                  : ""
                              }`}
                              onClick={() => handleDebugTestSelect(steps)}
                            >
                              <span className="text-sm">{name}</span>
                              <span className="text-xs text-gray-500">
                                {steps.length} steps
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </ResizablePanel>

                  <ResizableHandle className="h-[2px] bg-[#333] hover:bg-blue-500" />

                  {/* Step debugger panel */}
                  <ResizablePanel defaultSize={60}>
                    <div className="h-full flex flex-col overflow-hidden">
                      {selectedDebugTest ? (
                        <>
                          {/* Debug controls */}
                          <div className="p-2 flex items-center justify-between bg-[#2d2d2d] border-b border-[#333]">
                            <div className="flex space-x-2">
                              <button
                                className="p-1 hover:bg-[#3c3c3c] rounded"
                                onClick={() => setDebugStepIndex(0)}
                                title="First step"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M19 20L9 12l10-8v16z" />
                                  <line x1="5" y1="19" x2="5" y2="5" />
                                </svg>
                              </button>
                              <button
                                className="p-1 hover:bg-[#3c3c3c] rounded"
                                onClick={() =>
                                  setDebugStepIndex(
                                    Math.max(0, debugStepIndex - 1)
                                  )
                                }
                                title="Previous step"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M15 18l-6-6 6-6" />
                                </svg>
                              </button>
                              <button
                                className="p-1 hover:bg-[#3c3c3c] rounded"
                                onClick={() =>
                                  setDebugStepIndex(
                                    Math.min(
                                      selectedDebugTest.length - 1,
                                      debugStepIndex + 1
                                    )
                                  )
                                }
                                title="Next step"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M9 18l6-6-6-6" />
                                </svg>
                              </button>
                              <button
                                className="p-1 hover:bg-[#3c3c3c] rounded"
                                onClick={() =>
                                  setDebugStepIndex(
                                    selectedDebugTest.length - 1
                                  )
                                }
                                title="Last step"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M5 4l10 8-10 8V4z" />
                                  <line x1="19" y1="5" x2="19" y2="19" />
                                </svg>
                              </button>
                            </div>
                            <div className="text-xs text-gray-400">
                              Step {debugStepIndex + 1}/
                              {selectedDebugTest.length}
                            </div>
                          </div>

                          {/* Timeline track */}
                          <div className="h-8 flex items-center px-3 bg-[#2a2a2a] border-b border-[#333]">
                            <div className="w-full h-1 bg-[#3c3c3c] flex">
                              {selectedDebugTest.map((_, i) => (
                                <div
                                  key={i}
                                  className={`flex-1 h-1 mx-0.5 cursor-pointer ${
                                    i === debugStepIndex
                                      ? "bg-blue-500"
                                      : "bg-[#555]"
                                  }`}
                                  onClick={() => setDebugStepIndex(i)}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Variables panel */}
                          <div className="flex-1 overflow-y-auto">
                            {selectedDebugTest[debugStepIndex]?.vars ? (
                              <div className="p-2">
                                {Object.entries(
                                  selectedDebugTest[debugStepIndex].vars!
                                ).map(([k, v]) => {
                                  const changed =
                                    debugStepIndex > 0 &&
                                    JSON.stringify(
                                      selectedDebugTest[debugStepIndex - 1]
                                        ?.vars?.[k]
                                    ) !== JSON.stringify(v);
                                  return (
                                    <div
                                      key={k}
                                      className={`p-2 flex justify-between ${
                                        changed ? "bg-[#3c3c3c]" : ""
                                      }`}
                                    >
                                      <span className="font-mono text-xs">
                                        {k}
                                      </span>
                                      <span className="font-mono text-xs">
                                        {formatVal(v)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="p-4 text-center text-gray-500 text-sm">
                                No variables at this step
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                          Select a test to view debug steps
                        </div>
                      )}
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            )}

            {activeSidebarTab === "servers" && (
              <div className="flex-1 flex flex-col">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 flex items-center justify-between bg-[#252526]">
                  <span>MCP Servers</span>
                  <div className="flex space-x-1">
                    <button
                      className="hover:bg-[#3c3c3c] rounded p-1 focus:outline-none"
                      title="Refresh servers"
                      onClick={() => {
                        // Refresh server status check
                        console.log("Manually refreshing server status");
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                      </svg>
                    </button>
                    <button
                      className="hover:bg-[#3c3c3c] rounded p-1 focus:outline-none"
                      title="Add server"
                      onClick={() => setIsMpcServerConfigOpen(true)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                  {/* WebContainer status warning */}
                  {!webContainerReady && (
                    <div className="mb-4 p-3 rounded-md bg-red-900/20 border border-red-600/30">
                      <div className="flex items-center gap-2 text-red-400 text-sm">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>
                          WebContainer is not ready. MPC servers require a fully
                          initialized WebContainer.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Available servers section */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-white mb-2">
                      Available Servers
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(availableServerConfigs)
                        .filter(([key, _]) => !activeServers[key]) // Only show servers not already active
                        .map(([key, config]) => (
                          <div
                            key={key}
                            className="p-3 rounded bg-[#252526] hover:bg-[#2d2d2d] cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="mr-3 text-gray-400">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect
                                      x="2"
                                      y="2"
                                      width="20"
                                      height="8"
                                      rx="2"
                                      ry="2"
                                    ></rect>
                                    <rect
                                      x="2"
                                      y="14"
                                      width="20"
                                      height="8"
                                      rx="2"
                                      ry="2"
                                    ></rect>
                                    <line x1="6" y1="6" x2="6.01" y2="6"></line>
                                    <line
                                      x1="6"
                                      y1="18"
                                      x2="6.01"
                                      y2="18"
                                    ></line>
                                  </svg>
                                </div>
                                <div>
                                  <div className="font-medium text-sm">
                                    {key}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    Inactive
                                  </div>
                                </div>
                              </div>
                              <button
                                className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => initializeMPCServer(key)}
                                disabled={!webContainerReady}
                              >
                                Activate
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Active servers section */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-2">
                      Active Servers
                    </h3>
                    {Object.keys(activeServers).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(activeServers).map(([key, _]) => {
                          // Determine server status display
                          let statusColor = "text-gray-400";
                          let statusText = "Unknown";
                          let statusDotClass = "bg-gray-400";

                          if (serverStatus === "READY") {
                            statusColor = "text-green-400";
                            statusText = "Online";
                            statusDotClass = "bg-green-500";
                          } else if (
                            serverStatus === "STARTING" ||
                            serverStatus === "INSTALLING_NODE_MODULES"
                          ) {
                            statusColor = "text-yellow-400";
                            statusText =
                              serverStatus === "STARTING"
                                ? "Starting..."
                                : "Installing...";
                            statusDotClass = "bg-yellow-500 animate-pulse";
                          } else if (serverStatus === "ERROR") {
                            statusColor = "text-red-400";
                            statusText = "Error";
                            statusDotClass = "bg-red-500";
                          }

                          return (
                            <div
                              key={key}
                              className="p-3 rounded bg-[#252526] hover:bg-[#2d2d2d]"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="mr-3 text-blue-400">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <rect
                                        x="2"
                                        y="2"
                                        width="20"
                                        height="8"
                                        rx="2"
                                        ry="2"
                                      ></rect>
                                      <rect
                                        x="2"
                                        y="14"
                                        width="20"
                                        height="8"
                                        rx="2"
                                        ry="2"
                                      ></rect>
                                      <line
                                        x1="6"
                                        y1="6"
                                        x2="6.01"
                                        y2="6"
                                      ></line>
                                      <line
                                        x1="6"
                                        y1="18"
                                        x2="6.01"
                                        y2="18"
                                      ></line>
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm">
                                      {key}
                                    </div>
                                    <div
                                      className={`text-xs flex items-center ${statusColor}`}
                                    >
                                      <div
                                        className={`w-2 h-2 rounded-full ${statusDotClass} mr-1`}
                                      ></div>
                                      {statusText}
                                    </div>
                                    {serverStatus === "ERROR" && (
                                      <div className="text-xs text-red-400 mt-1">
                                        Check console for details
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => removeMPCServer(key)}
                                >
                                  Deactivate
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500 border border-dashed border-[#3c3c3c] rounded-md">
                        <p className="text-sm">No active servers</p>
                        <p className="text-xs mt-1">
                          Click "Activate" on a server to start it
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Add custom server button */}
                  <button
                    className="mt-4 flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
                    onClick={() => setIsMpcServerConfigOpen(true)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Custom Server
                  </button>
                </div>
              </div>
            )}

            {activeSidebarTab === "source-control" && (
              <div className="flex-1 flex flex-col">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 bg-[#252526] flex justify-between items-center">
                  <span>SOURCE CONTROL</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={runGitStatus}
                      className="p-1 rounded hover:bg-[#3c3c3c] focus:outline-none"
                      title="Refresh Git Status"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                      </svg>
                    </button>
                    <button
                      className="p-1 rounded hover:bg-[#3c3c3c] focus:outline-none"
                      title="More Actions"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    </button>
                  </div>
                </div>
                {gitLoading ? (
                  <div className="p-4 flex-1 flex flex-col items-center justify-center">
                    <svg
                      className="animate-spin h-8 w-8 text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <p className="mt-3 text-sm text-gray-400">
                      Loading git status...
                    </p>
                  </div>
                ) : gitStatus.isRepo ? (
                  <div className="flex-1 overflow-auto flex flex-col">
                    {/* Commit message input */}
                    <div className="p-2">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder='Message (⌘ ⏎ to commit on "main")'
                          className="w-full bg-[#3c3c3c] text-white border-0 rounded p-2 text-sm focus:ring-0 focus:outline-none"
                          id="commit-message"
                          value={commitMessage}
                          onChange={(e) => setCommitMessage(e.target.value)}
                        />
                        <button
                          className="absolute top-1/2 right-2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                          title="Command Palette"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </button>
                      </div>

                      {/* Commit button */}
                      <div className="flex mt-2">
                        <button
                          className="flex-1 bg-[#0E639C] hover:bg-[#1177bb] text-white rounded py-1.5 text-sm flex items-center justify-center"
                          onClick={async () => {
                            if (!commitMessage.trim()) {
                              alert("Please enter a commit message");
                              return;
                            }

                            if (!webContainer) return;
                            setGitLoading(true);
                            try {
                              // Stage all files
                              const addProcess = await webContainer.spawn(
                                "git",
                                ["add", "."]
                              );
                              await addProcess.exit;

                              // Commit changes
                              const commitProcess = await webContainer.spawn(
                                "git",
                                ["commit", "-m", commitMessage]
                              );
                              await commitProcess.exit;

                              // Clear the input field
                              setCommitMessage("");

                              // Refresh git status
                              runGitStatus();
                            } catch (error) {
                              console.error(
                                "Error staging and committing:",
                                error
                              );
                              alert(
                                `Error: ${
                                  error instanceof Error
                                    ? error.message
                                    : String(error)
                                }`
                              );
                              setGitLoading(false);
                            }
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-1"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Commit
                        </button>
                        <button className="bg-[#0E639C] hover:bg-[#1177bb] text-white rounded-r ml-px p-1.5">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Changes section */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between px-4 py-1 bg-[#252526] text-gray-300 text-xs">
                        <div className="flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-1"
                          >
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                          <span>Changes</span>
                        </div>
                        <div className="bg-[#3c3c3c] rounded-full py-0.5 px-2 text-xs">
                          11
                        </div>
                      </div>

                      {/* Changed files list */}
                      <div className="text-sm">
                        <div className="px-4 py-1.5 hover:bg-[#2a2a2a] flex items-center border-l-2 border-transparent">
                          <div className="text-blue-400 mr-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <span className="text-white">
                            .babel/plugins/debugger-instrumentation/README.md
                          </span>
                          <span className="ml-auto text-green-500 font-mono">
                            U
                          </span>
                        </div>
                        <div className="px-4 py-1.5 hover:bg-[#2a2a2a] flex items-center border-l-2 border-transparent">
                          <div className="text-blue-400 mr-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <span className="text-white">index.js</span>
                          <span className="ml-auto text-yellow-500 font-mono">
                            M
                          </span>
                        </div>
                        <div className="px-4 py-1.5 hover:bg-[#2a2a2a] flex items-center border-l-2 border-transparent">
                          <div className="text-blue-400 mr-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <span className="text-white">package.json</span>
                          <span className="ml-auto text-yellow-500 font-mono">
                            M
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Git status info (branch, etc) */}
                    <div className="mt-auto p-2 border-t border-[#3c3c3c] text-xs text-gray-400">
                      <div className="flex items-center">
                        <div className="flex items-center mr-4">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-1"
                          >
                            <line x1="6" y1="3" x2="6" y2="15"></line>
                            <circle cx="18" cy="6" r="3"></circle>
                            <circle cx="6" cy="18" r="3"></circle>
                            <path d="M18 9a9 9 0 0 1-9 9"></path>
                          </svg>
                          <span>main</span>
                        </div>
                        <button
                          className="hover:text-white"
                          onClick={runGitStatus}
                        >
                          Refresh
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex-1 flex flex-col items-center justify-center text-center text-gray-500 text-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mb-2"
                    >
                      <circle cx="18" cy="18" r="3" />
                      <circle cx="6" cy="6" r="3" />
                      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                      <line x1="6" y1="9" x2="6" y2="21" />
                    </svg>
                    <p>{gitStatus.status}</p>
                    <button
                      className="mt-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                      onClick={async () => {
                        if (!webContainer) return;
                        setGitLoading(true);
                        try {
                          const gitInitProcess = await webContainer.spawn(
                            "git",
                            ["init"]
                          );
                          const exitCode = await gitInitProcess.exit;

                          if (exitCode === 0) {
                            const emailConfigProcess = await webContainer.spawn(
                              "git",
                              [
                                "config",
                                "--global",
                                "user.email",
                                "user@example.com",
                              ]
                            );
                            await emailConfigProcess.exit;

                            const nameConfigProcess = await webContainer.spawn(
                              "git",
                              [
                                "config",
                                "--global",
                                "user.name",
                                "WebContainer User",
                              ]
                            );
                            await nameConfigProcess.exit;

                            runGitStatus();
                          } else {
                            throw new Error("Git init failed");
                          }
                        } catch (error) {
                          console.error("Error initializing git:", error);
                          setGitStatus({
                            isRepo: false,
                            status: `Error initializing git: ${
                              error instanceof Error
                                ? error.message
                                : String(error)
                            }`,
                          });
                          setGitLoading(false);
                        }
                      }}
                    >
                      Initialize Git Repository
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
          {/* Tabs bar */}
          <div className="h-9 flex items-center select-none bg-[#252526]">
            <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-[#3c3c3c] scrollbar-track-transparent">
              {openTabs.map((tabPath) => (
                <div
                  key={tabPath}
                  onClick={() => handleTabClick(tabPath)}
                  className={`px-3 py-1 flex items-center space-x-1 cursor-pointer text-sm max-w-xs group ${
                    activeTab === tabPath
                      ? "text-white bg-[#1e1e1e] border-b-2 border-blue-500"
                      : "text-gray-400 hover:bg-[#2d2d2d]"
                  }`}
                >
                  <span className="truncate">{tabPath.split("/").pop()}</span>
                  <button
                    onClick={(e) => handleCloseTab(tabPath, e)}
                    className="ml-1 text-gray-500 hover:text-white focus:outline-none opacity-0 group-hover:opacity-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* CodeMirror Editor - used for both regular editing and debugging */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* File tabs */}

              {/* Editor content */}
              <div className="flex-1 overflow-hidden">
                {selectedPaths.length > 0 && activeTab ? (
                  <CodeMirrorEditor
                    content={fileContent}
                    path={selectedPaths[0]}
                    onChange={setFileContent}
                    readOnly={false}
                    onReady={(view) => (cmViewRef.current = view)}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-[#1e1e1e]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mb-4 opacity-20"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    <p className="text-lg">
                      Select a file from the explorer to start editing
                    </p>
                    <p className="text-sm mt-2">
                      Or create a new file to begin
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Terminal panel at bottom */}
            {activePanels.bottom && (
              <div className="h-64 bg-[#1e1e1e] border-t border-[#252526]">
                <div className="bg-[#252526] px-4 py-1 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="font-medium">
                      TERMINAL {terminalMessage && `- ${terminalMessage}`}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      className="p-1 rounded hover:bg-[#3c3c3c] focus:outline-none"
                      onClick={() => togglePanel("bottom")}
                      title="Hide Terminal"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="h-[calc(100%-24px)] bg-[#1e1e1e]">
                  <WebTerminal
                    webContainer={webContainer}
                    height="100%"
                    initialCommands={[
                      'echo "Welcome to WebContainer Terminal"',
                    ]}
                    onInitialized={handleTerminalInitialized}
                    onError={handleTerminalError}
                    className="h-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel - Chat with AI */}
        {activePanels.right && (
          <div className="w-96 bg-[#1e1e1e] border-l border-[#252526] flex flex-col">
            <div className="h-9 bg-[#252526] flex items-center justify-between px-4">
              <span className="text-sm font-medium">AI Assistant</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Trigger clear messages via the webContainerAgent ref
                    if (webContainerAgentRef.current) {
                      webContainerAgentRef.current.handleClearMessages();
                    }
                  }}
                  className="text-gray-400 hover:text-white focus:outline-none"
                  title="New Chat"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
                <button
                  onClick={() => togglePanel("right")}
                  className="text-gray-400 hover:text-white focus:outline-none"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <WebContainerAgent
                ref={webContainerAgentRef}
                messages={messages}
                setMessages={setMessages}
                apiKey={apiKey}
                onRequestApiKey={onRequestApiKey}
                testResults={{}}
                serverConfigs={availableServerConfigs}
                activeServers={activeServers}
                setActiveServers={setActiveServers}
              />
            </div>
          </div>
        )}
      </div>

      {/* Add MPC Server Menu */}
      <MpcServerMenu
        serverConfigs={availableServerConfigs}
        activeServers={activeServers}
        serverStatus={serverStatus}
        webContainerReady={webContainerReady}
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
