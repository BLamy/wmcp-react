/* ------------------------------------------------------------------ *
 * Sidebar.tsx — Full VS‑Code‑style left sidebar                      *
 * ------------------------------------------------------------------ */

"use client";

import React, { useState, useEffect } from "react";
import type { WebContainer } from "@webcontainer/api";
import type { ServerConfig } from "@/wmcp/lib/McpClientManager";
import { ExplorerPane }      from "./ExplorerPane";

import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  ResizablePanel, ResizableHandle, ResizablePanelGroup,
} from "@/components/ui/resizable";


const formatVarValue = (v: unknown): React.ReactNode => {
    if (v === undefined) return <span className="undefined">undefined</span>;
    if (v === null) return <span className="null">null</span>;
    if (typeof v === "boolean") return <span className="boolean">{String(v)}</span>;
    if (typeof v === "number") return <span className="number">{v}</span>;
    if (typeof v === "string") return <span className="string">"{v}"</span>;
    return <span className="object">{JSON.stringify(v)}</span>;
  };
export interface DebugStep {
    file: string;
    line: number;
    vars?: Record<string, unknown>;
    stepNumber?: number;
  }
/* ────────────────────────────────────────────────────────────
   PROPS
──────────────────────────────────────────────────────────── */
export interface SidebarProps {
  /* FILES */
  selectedPaths: string[];
  handleFileSelection: (paths: string[]) => void;

  /* DEBUGGER */
  debugData:            Record<string, DebugStep[]> | null;
  parsedTests:          Record<string, DebugStep[]>;
  selectedDebugTest:    DebugStep[] | null;
  setSelectedDebugTest: (x: DebugStep[] | null) => void;
  debugStepIndex:       number;
  setDebugStepIndex:    (n: number) => void;
  testStatuses:         Record<string, string>;
  isRunningTests:       boolean;
  runTests:             () => void;
  initDebugData:        () => void;
  clearDebugHighlights: () => void;

  /* GIT / SOURCE CONTROL */
  gitLoading: boolean;
  gitStatus?: { isRepo: boolean; status: string };
  commitMessage: string;
  setCommitMessage: React.Dispatch<React.SetStateAction<string>>;
  runGitStatus: () => void;
  initGitRepo:  () => void;
  webContainer: WebContainer | null;

  /* MCP SERVERS */
  activeServers:          Record<string, ServerConfig>;
  availableServerConfigs: Record<string, ServerConfig>;
  serverStatus:           string | null;
  initializeMPCServer:    (name: string) => void;
  removeMPCServer:        (name: string) => void;
  addCustomMPCServer:     (name: string, cmd: string, args: string) => void;
  isMpcServerConfigOpen:  boolean;
  setIsMpcServerConfigOpen: (b: boolean) => void;
}

/* ────────────────────────────────────────────────────────────
   COMPONENT
──────────────────────────────────────────────────────────── */
export const Sidebar: React.FC<SidebarProps> = (props) => {
  /* ── props de‑structure ── */
  const {
    /* files */
    selectedPaths, handleFileSelection,
    /* debugger */
    debugData, parsedTests, selectedDebugTest, setSelectedDebugTest,
    debugStepIndex, setDebugStepIndex,
    testStatuses, isRunningTests, runTests, initDebugData, clearDebugHighlights,
    /* git */
    gitLoading, gitStatus = { isRepo: false, status: "Git status unknown" },
    commitMessage, setCommitMessage, runGitStatus, initGitRepo,
    webContainer,
    /* servers */
    activeServers, availableServerConfigs, serverStatus,
    initializeMPCServer, removeMPCServer, addCustomMPCServer,
    isMpcServerConfigOpen, setIsMpcServerConfigOpen,
  } = props;

  const [tab, setTab] = useState<
    "files" | "test-debugger" | "servers" | "source-control"
  >("files");

  // Initialize debug data when the Test Debugger tab is selected
  useEffect(() => {
    if (tab === "test-debugger") {
      initDebugData();
    }
  }, [tab, initDebugData]);

  /* ── original icons ── */
  const icon = {
    files: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    debugger: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10.94 13.5l-1.32 1.32a3.73 3.73 0 00-7.24 0L1.06 13.5 0 14.56l1.72 1.72-.22.22V18H0v1.5h1.5v.08c.077.489.214.966.41 1.42L0 22.94 1.06 24l1.65-1.65A4.308 4.308 0 006 24a4.31 4.31 0 003.29-1.65L10.94 24 12 22.94 10.09 21c.198-.464.336-.951.41-1.45v-.1H12V18h-1.5v-1.5l-.22-.22L12 14.56l-1.06-1.06zM6 13.5a2.25 2.25 0 012.25 2.25h-4.5A2.25 2.25 0 016 13.5zm3 6a3.33 3.33 0 01-3 3 3.33 3.33 0 01-3-3v-2.25h6v2.25zm14.76-9.9v1.26L13.5 17.37V15.6l8.5-5.37L9 2v9.46"/>
      </svg>
    ),
    servers: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
        <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
      </svg>
    ),
    git: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
        <path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>
      </svg>
    ),
  };

  /* ─────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────── */
  return (
    <div className="w-60 bg-[#1e1e1e] border-r border-[#252526] flex flex-col overflow-hidden">
      {/* TAB ROW */}
      <div className="h-9 bg-[#252526] flex items-center space-x-1 px-2">
        {([
          ["files","Files",icon.files],
          ["test-debugger","Test Debugger",icon.debugger],
          ["servers","MCP Servers",icon.servers],
          ["source-control","Source Control",icon.git],
        ] as const).map(([id,title,svg])=>(
          <button key={id}
            className={`p-1.5 rounded ${tab===id?"bg-[#3c3c3c] text-white":"text-gray-400 hover:bg-[#3c3c3c]"}`}
            title={title}
            onClick={()=>{
              setTab(id);
              if(id==="test-debugger")   initDebugData();
              if(id==="source-control")  runGitStatus();
            }}>
            {svg}
          </button>
        ))}
      </div>

      {/* ========== FILES ========== */}
      {tab==="files" && (
        <ExplorerPane
          webContainer={webContainer}
          selectedPaths={selectedPaths}
          onSelectFile={handleFileSelection}
        />
      )}

      {/* ========== TEST DEBUGGER ========== */}
      {tab==="test-debugger" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 bg-[#252526] flex justify-between">
            <span>Test Debugger</span>
            <div className="flex gap-2">
              {/* refresh */}
              <button title="Refresh debug data"
                onClick={initDebugData}
                className="p-1 hover:text-white text-gray-400">
                <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9A9 9 0 0 1 18.36 5.64L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </button>
              {/* run tests */}
              <button title="Run tests" disabled={isRunningTests}
                onClick={(e) => {
                  e.preventDefault();
                  runTests();
                }}
                className="p-1 hover:text-white text-gray-400">
                <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </button>
            </div>
          </div>

          <ResizablePanelGroup direction="vertical" className="flex-1 overflow-hidden">
            {/* ---- TEST LIST ---- */}
            <ResizablePanel defaultSize={40} minSize={20}>
              <div className="h-full overflow-y-auto py-2">
                {Object.keys(parsedTests).length===0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {isRunningTests? "Running tests…" : "No debug data found"}
                  </div>
                ):(
                  <ul className="space-y-1 px-2">
                    {Object.entries(parsedTests).map(([testName, steps])=>{
                      // Simple display of test name with step count
                      return(
                        <li key={testName}>
                          <div 
                            className={`px-4 py-2 rounded hover:bg-[#2a2d2e] cursor-pointer flex items-center justify-between
                                      ${selectedDebugTest === steps ? "bg-[#37373d]" : ""}`}
                            onClick={() => {
                              // First clear any existing highlights
                              clearDebugHighlights();
                              // Then select this test and set to first step
                              setSelectedDebugTest(steps);
                              setDebugStepIndex(0);
                              console.log("Selected test with", steps.length, "steps");
                            }}>
                            <span className="text-sm truncate">{testName}</span>
                            <span className="text-xs text-gray-500 ml-2">{steps.length} steps</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle className="h-[2px] bg-[#333]" />

            {/* ---- STEP / VARS VIEWER ---- */}
            <ResizablePanel defaultSize={60}>
              <div className="h-full flex flex-col overflow-hidden">
                {selectedDebugTest ? (
                  <>
                    {/* timeline header */}
                    <div className="p-2 flex items-center justify-between bg-[#2d2d2d] border-b border-[#333]">
                      <div className="flex space-x-1">
                        {/* nav buttons */}
                        <NavBtn title="First" onClick={()=>setDebugStepIndex(0)}>&#124;&#8249;</NavBtn>
                        <NavBtn title="Prev"  onClick={()=>setDebugStepIndex(Math.max(0,debugStepIndex-1))}>&#8249;</NavBtn>
                        <NavBtn title="Next"  onClick={()=>setDebugStepIndex(Math.min(selectedDebugTest.length-1,debugStepIndex+1))}>&#8250;</NavBtn>
                        <NavBtn title="Last"  onClick={()=>setDebugStepIndex(selectedDebugTest.length-1)}>&#8250;&#124;</NavBtn>
                      </div>
                      <span className="text-xs text-gray-400">
                        Step {debugStepIndex+1}/{selectedDebugTest.length}
                      </span>
                    </div>

                    {/* blue timeline */}
                    <div className="h-8 flex items-center px-3 bg-[#2a2a2a] border-b border-[#333]">
                      <div className="w-full h-1 bg-[#3c3c3c] flex">
                        {selectedDebugTest.map((_,i)=>(
                          <div 
                            key={i}
                            className={`flex-1 mx-0.5 cursor-pointer ${i===debugStepIndex?"bg-blue-500":"bg-[#555]"}`}
                            onClick={()=>{
                              // Clear any highlights before changing steps
                              clearDebugHighlights();
                              setDebugStepIndex(i);
                            }} />
                        ))}
                      </div>
                    </div>

                    {/* vars */}
                    <div className="flex-1 overflow-y-auto p-2">
                      {selectedDebugTest[debugStepIndex]?.vars ? (
                        Object.entries(selectedDebugTest[debugStepIndex].vars!).map(([k,v])=>{
                          const changed = debugStepIndex>0 &&
                            JSON.stringify(selectedDebugTest[debugStepIndex-1]?.vars?.[k])!==JSON.stringify(v);
                          return(
                            <div key={k} className={`p-1 flex justify-between ${changed?"bg-[#3c3c3c]":""}`}>
                              <span className="font-mono text-xs">{k}</span>
                              <span className="font-mono text-xs">{formatVarValue(v)}</span>
                            </div>
                          );
                        })
                      ):(
                        <p className="text-center text-gray-500 text-sm mt-4">No variables at this step</p>
                      )}
                    </div>
                  </>
                ):(
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                    Select a test to view steps
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}

      {/* ========== MCP SERVERS ========== */}
      {tab==="servers" && (
        <div className="flex-1 flex flex-col">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 flex justify-between items-center bg-[#252526]">
            <span>MCP Servers</span>
            <div className="flex gap-1">
              <button className="p-1 hover:bg-[#3c3c3c] rounded"
                title="Add custom server"
                onClick={()=>setIsMpcServerConfigOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24"
                  stroke="currentColor" fill="none" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto flex-1 space-y-6">
            {/* available */}
            <section>
              <h3 className="text-sm font-medium text-white mb-2">Available</h3>
              {Object.entries(availableServerConfigs)
                .filter(([k])=>!activeServers[k])
                .map(([name])=>(
                  <div key={name}
                    className="p-3 rounded bg-[#252526] hover:bg-[#2d2d2d] flex justify-between items-center">
                    <span>{name}</span>
                    <button
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
                      onClick={()=>initializeMPCServer(name)}>
                      Activate
                    </button>
                  </div>
                ))}
              {Object.keys(availableServerConfigs).filter(k=>!activeServers[k]).length===0 && (
                <p className="text-xs text-gray-500">No inactive servers</p>
              )}
            </section>

            {/* active */}
            <section>
              <h3 className="text-sm font-medium text-white mb-2">Active</h3>
              {Object.keys(activeServers).length ? Object.entries(activeServers).map(([name])=>{
                let dot="bg-gray-400", text="Unknown";
                if(serverStatus==="READY"){ dot="bg-green-500"; text="Online"; }
                else if(serverStatus==="STARTING"){ dot="bg-yellow-500 animate-pulse"; text="Starting"; }
                else if(serverStatus==="ERROR"){ dot="bg-red-500"; text="Error"; }
                return(
                  <div key={name}
                    className="p-3 rounded bg-[#252526] flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${dot}`}></span>
                      <span>{name}</span>
                    </div>
                    <button
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                      onClick={()=>removeMPCServer(name)}>
                      Deactivate
                    </button>
                  </div>
                );
              }):(
                <p className="text-xs text-gray-500">No active servers</p>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ========== SOURCE CONTROL ========== */}
      {tab==="source-control" && (
        <div className="flex-1 flex flex-col">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 bg-[#252526] flex justify-between items-center">
            <span>Source Control</span>
            <button className="p-1 hover:bg-[#3c3c3c] rounded"
              title="Refresh git status"
              onClick={runGitStatus}>
              <svg width="14" height="14" viewBox="0 0 24 24"
                stroke="currentColor" fill="none" strokeWidth="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
            </button>
          </div>

          {gitLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Loading git status…
            </div>
          ): gitStatus.isRepo ? (
            <>
              {/* commit input */}
              <div className="p-2 border-b border-[#3c3c3c]">
                <input
                  className="w-full bg-[#3c3c3c] text-white rounded p-2 text-sm"
                  placeholder="Commit message (⌘⏎)"
                  value={commitMessage}
                  onChange={(e)=>setCommitMessage(e.target.value)}
                />
              </div>
              {/* status text (keep simple) */}
              <div className="flex-1 overflow-auto whitespace-pre-wrap text-xs text-gray-400 p-2">
                {gitStatus.status}
              </div>
            </>
          ):(
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 text-sm p-4">
              <p>{gitStatus.status}</p>
              <button
                className="mt-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
                onClick={initGitRepo}>
                Initialize Git Repository
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;

/* ────────────────────────────────────────────────────────────
   Small helper for nav arrows in debugger
──────────────────────────────────────────────────────────── */
const NavBtn: React.FC<{title:string; onClick:()=>void; children:React.ReactNode}> = ({title, children, onClick})=>(
  <button title={title} onClick={onClick}
    className="px-1 text-gray-400 hover:text-white">
    {children}
  </button>
);