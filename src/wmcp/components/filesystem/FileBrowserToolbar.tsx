import React, { useState } from 'react';
import { Button } from '../../../Button';
import { useFileOperations } from './useFileOperations';
import { WebContainer } from '@webcontainer/api';

export interface FileBrowserToolbarProps {
  /** WebContainer instance */
  webContainer: WebContainer | null;
  /** Handler for refresh operations */
  onRefresh?: () => void;
  /** Currently selected file paths */
  selectedPaths?: string[];
  /** Currently active path (for new file/folder creation) */
  activePath?: string;
  /** Add custom operations */
  customOperations?: React.ReactNode;
  /** Whether operations are currently loading */
  isLoading?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Callback when a file is created */
  onFileCreated?: (path: string) => void;
  /** Callback when a directory is created */
  onDirectoryCreated?: (path: string) => void;
  /** Callback when a file or directory is deleted */
  onDelete?: (path: string) => void;
}

/**
 * A reusable toolbar for file browser operations
 */
export function FileBrowserToolbar({
  webContainer,
  onRefresh,
  selectedPaths = [],
  activePath = '/',
  customOperations,
  isLoading = false,
  className = '',
  onFileCreated,
  onDirectoryCreated,
  onDelete
}: FileBrowserToolbarProps) {
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const {
    createFile,
    createDirectory,
    deleteFileOrDir,
    error,
    isLoading: isOperationLoading
  } = useFileOperations(webContainer);

  // Get the active directory path (either the selected directory or the parent of a selected file)
  const getActiveDirectory = () => {
    if (!selectedPaths.length) return activePath;
    
    const path = selectedPaths[0];
    if (path.endsWith('/')) return path;
    
    // If it's a file, get its parent directory
    const lastSlashIndex = path.lastIndexOf('/');
    return lastSlashIndex > 0 ? path.substring(0, lastSlashIndex + 1) : '/';
  };

  // Create a new file
  const handleCreateFile = async () => {
    if (!newItemName) return;
    
    const dirPath = getActiveDirectory();
    const filePath = `${dirPath === '/' ? '' : dirPath}/${newItemName}`;
    
    const success = await createFile(filePath, '');
    if (success) {
      if (onFileCreated) onFileCreated(filePath);
      if (onRefresh) onRefresh();
      setNewItemName('');
      setShowNewFileDialog(false);
    }
  };

  // Create a new folder
  const handleCreateFolder = async () => {
    if (!newItemName) return;
    
    const dirPath = getActiveDirectory();
    const folderPath = `${dirPath === '/' ? '' : dirPath}/${newItemName}`;
    
    const success = await createDirectory(folderPath);
    if (success) {
      if (onDirectoryCreated) onDirectoryCreated(folderPath);
      if (onRefresh) onRefresh();
      setNewItemName('');
      setShowNewFolderDialog(false);
    }
  };

  // Delete selected file or folder
  const handleDelete = async () => {
    if (!selectedPaths.length) return;
    
    const path = selectedPaths[0];
    
    if (confirm(`Are you sure you want to delete ${path}?`)) {
      const success = await deleteFileOrDir(path);
      if (success) {
        if (onDelete) onDelete(path);
        if (onRefresh) onRefresh();
      }
    }
  };

  return (
    <div className={`p-2 bg-gray-100 border-b flex flex-wrap items-center gap-2 ${className}`}>
      {/* Refresh button */}
      <Button
        onPress={onRefresh}
        isDisabled={isLoading || isOperationLoading}
      >
        <div className="flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </div>
      </Button>

      {/* New file button */}
      {showNewFileDialog ? (
        <div className="flex items-center">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="file.txt"
            className="px-2 py-1 border rounded-l-md"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
          />
          <Button
            onPress={handleCreateFile}
            isDisabled={!newItemName || isOperationLoading}
            className="rounded-l-none"
          >
            Create
          </Button>
          <Button
            onPress={() => {
              setShowNewFileDialog(false);
              setNewItemName('');
            }}
            className="ml-1"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          onPress={() => setShowNewFileDialog(true)}
          isDisabled={isLoading || isOperationLoading}
        >
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            New File
          </div>
        </Button>
      )}

      {/* New folder button */}
      {showNewFolderDialog ? (
        <div className="flex items-center">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="folder"
            className="px-2 py-1 border rounded-l-md"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <Button
            onPress={handleCreateFolder}
            isDisabled={!newItemName || isOperationLoading}
            className="rounded-l-none"
          >
            Create
          </Button>
          <Button
            onPress={() => {
              setShowNewFolderDialog(false);
              setNewItemName('');
            }}
            className="ml-1"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          onPress={() => setShowNewFolderDialog(true)}
          isDisabled={isLoading || isOperationLoading}
        >
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            New Folder
          </div>
        </Button>
      )}

      {/* Delete button */}
      <Button
        onPress={handleDelete}
        isDisabled={!selectedPaths.length || isLoading || isOperationLoading}
      >
        <div className="flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </div>
      </Button>

      {/* Custom operations */}
      {customOperations}
      
      {/* Error display */}
      {error && (
        <div className="ml-auto text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
} 