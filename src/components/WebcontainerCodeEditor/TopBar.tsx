// components/TopBar.tsx
"use client";

import React, { useRef, useState, useMemo } from "react";

export interface TopBarProps {
  activePanels: { left: boolean; bottom: boolean; right: boolean; overlay: boolean };
  togglePanel:  (p: "left" | "bottom" | "right" | "overlay") => void;
}

/** VS‑Code‑style top strip with command‑palette + panel toggles */
export const TopBar: React.FC<TopBarProps> = ({ activePanels, togglePanel }) => {
  /* —— command palette (CMD‑K) —— */
  const [cmdkOpen,   setCmdkOpen]   = useState(false);
  const [search,     setSearch]     = useState("");
  const searchRef                 = useRef<HTMLInputElement>(null);

  const commands = useMemo(
    () => [
      { id: "toggle-terminal",  name: "Toggle Terminal",  shortcut: "⌃`", icon: "terminal" },
      { id: "toggle-chat",      name: "Toggle AI Chat",   shortcut: "⌘J", icon: "message-square" },
      { id: "toggle-explorer",  name: "Toggle Explorer",  shortcut: "⌘E", icon: "folder-open" },
    ],
    []
  );
  const filtered = commands.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const exec = (id: string) => {
    if (id === "toggle-terminal") togglePanel("bottom");
    if (id === "toggle-chat")     togglePanel("right");
    if (id === "toggle-explorer") togglePanel("left");
    setCmdkOpen(false);
  };

  /* —— key handler for ⌘K —— */
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen(true);
        setTimeout(() => searchRef.current?.focus(), 10);
      }
      if (e.key === "Escape") setCmdkOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="h-9 bg-[#252526] flex items-center px-2 text-sm justify-between shadow-sm">
      <span className="text-gray-300 font-medium">WebContainer&nbsp;IDE</span>

      {/* —— Command‑palette trigger —— */}
      <div
        className="flex-1 mx-4 max-w-[40%]"
        onClick={() => { setCmdkOpen(true); setTimeout(() => searchRef.current?.focus(), 10); }}
      >
        <div className="flex items-center bg-[#3c3c3c] rounded h-6 px-2 cursor-pointer hover:bg-[#4c4c4c]">
          {/* search icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" className="text-gray-400 mr-2" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span className="flex-1 text-xs text-gray-400 truncate">Search or run command</span>
          <span className="ml-4 text-xs bg-[#2a2a2a] rounded px-1 text-gray-400">⌘K</span>
        </div>

        {/* palette UI */}
        {cmdkOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setCmdkOpen(false)} />
            <div className="absolute left-0 w-[500px] top-8 bg-[#252526] border border-[#3c3c3c] rounded-md shadow-lg z-50">
              <div className="p-2 border-b border-[#3c3c3c]">
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type a command..."
                  className="w-full bg-[#3c3c3c] text-white rounded p-2 text-sm focus:outline-none"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {filtered.length ? filtered.map(c => (
                  <div key={c.id}
                       className="px-3 py-2 hover:bg-[#3c3c3c] flex justify-between cursor-pointer text-sm"
                       onClick={() => exec(c.id)}>
                    <span>{c.name}</span>
                    <span className="text-gray-500 text-xs">{c.shortcut}</span>
                  </div>
                )) : (
                  <div className="p-4 text-center text-gray-500">No commands</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
      {/* —— Toggle icons —— */}
      {(["left","bottom","right","overlay"] as const).map(p => (
        <button key={p}
          onClick={() => togglePanel(p)}
          className={`p-1.5 rounded mx-0.5 ${activePanels[p] ? "text-white bg-[#3c3c3c]" : "text-gray-400 hover:bg-[#3c3c3c]"}`}>
          {p === "left"   && <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>}
          {p === "bottom" && <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>}
          {p === "right"  && <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
          {p === "overlay"&& <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06"/></svg>}
        </button>
      ))}</div>
    </div>
  );
};
export default TopBar;