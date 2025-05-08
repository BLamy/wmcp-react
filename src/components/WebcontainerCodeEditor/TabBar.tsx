// components/TabBar.tsx
"use client";

import React from "react";

export interface TabBarProps {
  openTabs: string[];
  activeTab: string | null;
  onTabClick:  (path: string) => void;
  onCloseTab: (path: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ openTabs, activeTab, onTabClick, onCloseTab }) => (
  <div className="h-9 flex items-center bg-[#252526] select-none overflow-x-auto">
    {openTabs.map(path => {
      const name = path.split("/").pop();
      const isActive = activeTab === path;
      return (
        <div key={path}
             onClick={() => onTabClick(path)}
             className={`px-3 py-1 flex items-center space-x-1 text-sm cursor-pointer max-w-xs group
                         ${isActive ? "text-white bg-[#1e1e1e] border-b-2 border-blue-500"
                                     : "text-gray-400 hover:bg-[#2d2d2d]"}`}>
          <span className="truncate">{name}</span>
          <button
            className="ml-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onCloseTab(path); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      );
    })}
  </div>
);

export default TabBar;