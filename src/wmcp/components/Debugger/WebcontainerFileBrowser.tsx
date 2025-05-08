/* WebcontainerFileBrowser.tsx — standalone file browser component
   ------------------------------------------------------------------
   * No WebContainer deps
   * Works with DumbFileMap
   * Matching UI style with DumbDebugger
*/

"use client";

import React, { FC, useMemo } from "react";
import { DumbFileMap } from "./DumbDebugger";
import { FolderIcon, FolderOpenIcon, FileIcon, ChevronRightIcon, ChevronDownIcon } from "./icons";

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
}

interface WebcontainerFileBrowserProps {
  files: DumbFileMap;
  currentFile: string;
  onFileSelect: (filePath: string) => void;
}

// Converts flat DumbFileMap to hierarchical tree structure
const buildFileTree = (files: DumbFileMap): TreeNode[] => {
  const root: TreeNode[] = [];
  const directories: Record<string, TreeNode> = {};

  // Sort filenames to ensure consistent order
  const sortedFilenames = Object.keys(files).sort();

  for (const filePath of sortedFilenames) {
    // Skip files we can't display
    if (!filePath) continue;

    const pathParts = filePath.split('/');
    const fileName = pathParts.pop() || '';
    let currentLevel = root;
    let currentPath = '';

    // Create or navigate the directory structure
    for (const part of pathParts) {
      if (!part) continue; // Skip empty parts
      
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      // Create directory if it doesn't exist yet
      if (!directories[currentPath]) {
        const newDir: TreeNode = {
          name: part,
          path: currentPath,
          isDirectory: true,
          children: []
        };
        directories[currentPath] = newDir;
        currentLevel.push(newDir);
      }
      
      currentLevel = directories[currentPath].children;
    }

    // Add the file to the current level
    currentLevel.push({
      name: fileName,
      path: filePath,
      isDirectory: false,
      children: []
    });
  }

  return root;
};

// Tree node renderer component
const TreeNodeComponent: FC<{
  node: TreeNode;
  currentFile: string;
  onFileSelect: (filePath: string) => void;
  expandedPaths: Set<string>;
  toggleExpanded: (path: string) => void;
  level: number;
}> = ({ node, currentFile, onFileSelect, expandedPaths, toggleExpanded, level }) => {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = currentFile === node.path;
  const paddingLeft = `${level * 16}px`;

  if (node.isDirectory) {
    return (
      <div>
        <div 
          className={`flex items-center py-1 hover:bg-[#2a2d2e] cursor-pointer text-[13px]`}
          style={{ paddingLeft }}
          onClick={() => toggleExpanded(node.path)}
        >
          {isExpanded ? 
            <ChevronDownIcon className="w-4 h-4 mr-1" /> : 
            <ChevronRightIcon className="w-4 h-4 mr-1" />
          }
          {isExpanded ? 
            <FolderOpenIcon className="w-4 h-4 mr-2 text-amber-500" /> : 
            <FolderIcon className="w-4 h-4 mr-2 text-amber-500" />
          }
          <span>{node.name}</span>
        </div>
        
        {isExpanded && node.children.length > 0 && (
          <div>
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.path}
                node={child}
                currentFile={currentFile}
                onFileSelect={onFileSelect}
                expandedPaths={expandedPaths}
                toggleExpanded={toggleExpanded}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center py-1 ${
        isSelected ? 'bg-[#37373d] text-white' : 'hover:bg-[#2a2d2e]'
      } cursor-pointer text-[13px]`}
      style={{ paddingLeft }}
      onClick={() => onFileSelect(node.path)}
    >
      <FileIcon className="w-4 h-4 mr-2 text-blue-500 ml-5" />
      <span>{node.name}</span>
    </div>
  );
};

export const WebcontainerFileBrowser: FC<WebcontainerFileBrowserProps> = ({ 
  files, 
  currentFile,
  onFileSelect 
}) => {
  // Convert DumbFileMap to tree structure
  const fileTree = useMemo(() => buildFileTree(files), [files]);
  
  // Track expanded directories
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(new Set(['/']));
  
  const toggleExpanded = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-[#252526] text-[#e0e0e0]">
      {/* Header */}
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 flex items-center justify-between bg-[#252526] border-b border-[#333]">
        <span>Files</span>
      </div>
      
      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {fileTree.length > 0 ? (
          <div className="py-1">
            {fileTree.map((node) => (
              <TreeNodeComponent
                key={node.path}
                node={node}
                currentFile={currentFile}
                onFileSelect={onFileSelect}
                expandedPaths={expandedPaths}
                toggleExpanded={toggleExpanded}
                level={0}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 text-[#888] text-center">
            No files available
          </div>
        )}
      </div>
    </div>
  );
};

export default WebcontainerFileBrowser; 