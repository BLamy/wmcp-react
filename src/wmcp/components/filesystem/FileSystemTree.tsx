import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react';
import { 
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '../../../components/ui/sidebar';
import { FileSystemTree as WebContainerFileSystemTree } from '@webcontainer/api';

interface FSEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FSEntry[];
}

/**
 * Props for the FileSystemTree component
 */
export interface FileSystemTreeProps {
  /** The file system entries to render */
  files: FSEntry[];
  /** Handler for selection changes */
  onSelectionChange?: (paths: string[]) => void;
  /** Currently selected paths */
  selectedPaths?: string[];
  /** Currently expanded paths */
  expandedPaths?: string[];
  /** Handler for expansion changes */
  onExpandedChange?: (paths: string[]) => void;
  /** Custom renderer for file/directory icons */
  renderIcon?: (entry: FSEntry) => React.ReactNode;
  /** Whether the tree is disabled */
  disabled?: boolean;
  /** Selection mode for the tree */
  selectionMode?: 'single' | 'multiple' | 'none';
  /** Auto refresh interval in milliseconds (set to 0 to disable) */
  refreshInterval?: number;
  /** Callback to rebuild/refresh the file tree */
  onRefresh?: () => Promise<void> | void;
  /** Show loading indicator during auto-refresh */
  showAutoRefreshIndicator?: boolean;
}

/**
 * A reusable component for displaying file system trees with a sidebar UI
 */
export const FileSystemTree = React.memo(function FileSystemTree({
  files,
  onSelectionChange,
  selectedPaths = [],
  expandedPaths = [],
  onExpandedChange,
  renderIcon,
  disabled = false,
  selectionMode = 'single',
  refreshInterval = 0,
  onRefresh,
  showAutoRefreshIndicator = false
}: FileSystemTreeProps) {
  const [expandedFoldersState, setExpandedFoldersState] = useState<Record<string, boolean>>(
    expandedPaths.reduce((acc, path) => ({ ...acc, [path]: true }), {})
  );
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMounted = useRef(true);
  const intervalIdRef = useRef<number | null>(null);

  // Ref to hold the latest isRefreshing value for use in doRefresh without adding to useEffect deps
  const isRefreshingRef = useRef(isRefreshing);
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (intervalIdRef.current) {
        window.clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, []);
  
  useEffect(() => {
    if (intervalIdRef.current) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    
    if (!onRefresh || !refreshInterval || refreshInterval < 1000) {
      return;
    }
    
    const doRefresh = async () => {
      if (isRefreshingRef.current || !isMounted.current) {
        return;
      }
      
      if (showAutoRefreshIndicator) {
        setIsRefreshing(true);
      }
      
      try {
        await Promise.resolve(onRefresh());
      } catch (err) {
        console.error('Error in background refresh:', err);
      } finally {
        if (isMounted.current && showAutoRefreshIndicator) {
          setIsRefreshing(false);
        }
      }
    };
    
    doRefresh();
    
    const id = window.setInterval(doRefresh, refreshInterval);
    intervalIdRef.current = id;
    
    return () => {
      if (intervalIdRef.current) {
        window.clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [refreshInterval, onRefresh, showAutoRefreshIndicator]);

  // Handle folder toggle
  const toggleFolder = React.useCallback((path: string) => {
    const newExpandedFolders = {
      ...expandedFoldersState,
      [path]: !expandedFoldersState[path]
    };
    
    setExpandedFoldersState(newExpandedFolders);
    
    if (onExpandedChange) {
      onExpandedChange(Object.entries(newExpandedFolders)
        .filter(([_, isExpanded]) => isExpanded)
        .map(([path]) => path));
    }
  }, [expandedFoldersState, onExpandedChange]);

  // Handle file selection
  const handleSelectFile = React.useCallback((path: string) => {
    if (onSelectionChange) {
      if (selectionMode === 'single') {
        onSelectionChange([path]);
      } else if (selectionMode === 'multiple') {
        const isSelected = selectedPaths.includes(path);
        if (isSelected) {
          onSelectionChange(selectedPaths.filter(p => p !== path));
        } else {
          onSelectionChange([...selectedPaths, path]);
        }
      }
    }
  }, [onSelectionChange, selectionMode, selectedPaths]);

  // Default icon renderer
  const defaultRenderIcon = React.useCallback((entry: FSEntry) => {
    if (entry.isDirectory) {
      return expandedFoldersState[entry.path] ? 
        <FolderOpenIcon className="h-4 w-4 mr-2 shrink-0 text-amber-500" /> : 
        <FolderIcon className="h-4 w-4 mr-2 shrink-0 text-amber-500" />;
    }
    return <FileIcon className="h-4 w-4 mr-2 shrink-0 text-blue-500" />;
  }, [expandedFoldersState]);

  // Render tree items recursively
  const renderFileTree = React.useCallback((entries: FSEntry[]) => {
    return entries.map(entry => {
      const path = entry.path;
      const isExpanded = expandedFoldersState[path];
      const isSelected = selectedPaths.includes(path);
      
      if (entry.isDirectory) {
        return (
          <SidebarMenuItem key={path}>
            <SidebarMenuButton 
              onClick={() => toggleFolder(path)} 
              className={`justify-start ${isSelected ? 'bg-muted' : ''}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 mr-1 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-1 shrink-0" />
              )}
              {renderIcon ? renderIcon(entry) : defaultRenderIcon(entry)}
              <span className="truncate">{entry.name}</span>
            </SidebarMenuButton>

            {isExpanded && entry.children && entry.children.length > 0 && (
              <div className="pl-5 border-l border-gray-200 dark:border-gray-800 ml-2 mt-1">
                {renderFileTree(entry.children)}
              </div>
            )}
          </SidebarMenuItem>
        );
      } else {
        return (
          <SidebarMenuItem key={path}>
            <SidebarMenuButton 
              onClick={() => handleSelectFile(path)}
              className={`justify-start ${isSelected ? 'bg-muted text-foreground' : ''} text-sm pl-7`}
            >
              {renderIcon ? renderIcon(entry) : defaultRenderIcon(entry)}
              <span className="truncate">{entry.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      }
    });
  }, [expandedFoldersState, selectedPaths, toggleFolder, handleSelectFile, renderIcon, defaultRenderIcon]);

  return (
    <div className="file-system-tree">
      {showAutoRefreshIndicator && isRefreshing && (
        <div className="px-2 py-1 text-xs text-muted-foreground bg-muted/30 flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Refreshing...
        </div>
      )}
      <SidebarMenu>{renderFileTree(files)}</SidebarMenu>
    </div>
  );
});