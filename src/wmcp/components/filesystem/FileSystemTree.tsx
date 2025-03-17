import React from 'react';
import { Tree, TreeItem, TreeItemContent } from '../../../Tree';
import { FileSystemTree as WebContainerFileSystemTree} from '@webcontainer/api';


/**
 * Props for the FileSystemTree component
 */
export interface FileSystemTreeProps {
  /** The file system entries to render */
  files: WebContainerFileSystemTree[];
  /** Handler for selection changes */
  onSelectionChange?: (paths: string[]) => void;
  /** Currently selected paths */
  selectedPaths?: string[];
  /** Currently expanded paths */
  expandedPaths?: string[];
  /** Handler for expansion changes */
  onExpandedChange?: (paths: string[]) => void;
  /** Custom renderer for file/directory icons */
  renderIcon?: (entry:  WebContainerFileSystemTree) => React.ReactNode;
  /** Whether the tree is disabled */
  disabled?: boolean;
  /** Selection mode for the tree */
  selectionMode?: 'single' | 'multiple' | 'none';
}

/**
 * A reusable component for displaying file system trees
 */
export function FileSystemTree({
  files,
  onSelectionChange,
  selectedPaths = [],
  expandedPaths = [],
  onExpandedChange,
  renderIcon,
  disabled = false,
  selectionMode = 'single'
}: FileSystemTreeProps) {
  // Handle tree selection change
  const handleSelectionChange = (keys: Set<React.Key>) => {
    if (onSelectionChange) {
      const selectedKeysArray = Array.from(keys).map(key => String(key));
      onSelectionChange(selectedKeysArray);
    }
  };

  // Handle tree expansion change
  const handleExpandedChange = (keys: Set<React.Key>) => {
    if (onExpandedChange) {
      onExpandedChange(Array.from(keys).map(key => String(key)));
    }
  };

  // Default icon renderer
  const defaultRenderIcon = (entry: WebContainerFileSystemTree) => {
    if (entry.isDirectory) {
      return (
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  // Render tree items recursively
  const renderTreeItems = (entries: FSEntry[]) => {
    return entries.map(entry => (
      <TreeItem 
        key={entry.path} 
        id={entry.path} 
        textValue={entry.name}
      >
        <TreeItemContent>
          <div className="flex items-center">
            {renderIcon ? renderIcon(entry) : defaultRenderIcon(entry)}
            <span className={entry.isDirectory ? "font-medium" : ""}>{entry.name}</span>
          </div>
        </TreeItemContent>
        {entry.children && entry.children.length > 0 && renderTreeItems(entry.children)}
      </TreeItem>
    ));
  };

  return (
    <Tree 
      aria-label="File System" 
      selectionMode={selectionMode}
      selectedKeys={selectedPaths}
      onSelectionChange={handleSelectionChange}
      expandedKeys={expandedPaths}
      onExpandedChange={handleExpandedChange}
      disabledKeys={disabled ? files.map(f => f.path) : []}
    >
      {renderTreeItems(files)}
    </Tree>
  );
} 