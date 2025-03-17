import { useState, useCallback } from 'react';
import { WebContainer, FileSystemTree as WebContainerFileSystemTree} from '@webcontainer/api';
/**
 * Interface for the return value of the useFileOperations hook
 */
export interface FileOperationsResult {
  /** Load a file's content */
  loadFile: (path: string) => Promise<string>;
  /** Save content to a file */
  saveFile: (path: string, content: string) => Promise<boolean>;
  /** Create a new directory */
  createDirectory: (path: string) => Promise<boolean>;
  /** Delete a file or directory */
  deleteFileOrDir: (path: string, isDirectory?: boolean) => Promise<boolean>;
  /** Create a new file */
  createFile: (path: string, content?: string) => Promise<boolean>;
  /** Build a file system tree from the file system */
  buildFileTree: (dir?: string) => Promise<WebContainerFileSystemTree[]>;
  /** Current error if any */
  error: string | null;
  /** Whether an operation is in progress */
  isLoading: boolean;
}

/**
 * A custom hook for working with files in a WebContainer
 */
export function useFileOperations(webContainer: WebContainer | null): FileOperationsResult {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load a file's content
   */
  const loadFile = useCallback(async (path: string): Promise<string> => {
    if (!webContainer) {
      setError('WebContainer not available');
      return '';
    }

    setIsLoading(true);
    setError(null);

    try {
      const fileContent = await webContainer.fs.readFile(path, 'utf-8');
      return fileContent;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to read file: ${errorMessage}`);
      return '';
    } finally {
      setIsLoading(false);
    }
  }, [webContainer]);

  /**
   * Save content to a file
   */
  const saveFile = useCallback(async (path: string, content: string): Promise<boolean> => {
    if (!webContainer) {
      setError('WebContainer not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      await webContainer.fs.writeFile(path, content);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to save file: ${errorMessage}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [webContainer]);

  /**
   * Create a new directory
   */
  const createDirectory = useCallback(async (path: string): Promise<boolean> => {
    if (!webContainer) {
      setError('WebContainer not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      await webContainer.fs.mkdir(path, { recursive: true });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to create directory: ${errorMessage}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [webContainer]);

  /**
   * Delete a file or directory
   */
  const deleteFileOrDir = useCallback(async (path: string, isDirectory?: boolean): Promise<boolean> => {
    if (!webContainer) {
      setError('WebContainer not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isDirectory === undefined) {
        try {
          // Try to determine if it's a directory by attempting to read it as a directory
          await webContainer.fs.readdir(path);
          isDirectory = true;
        } catch (err) {
          // If readdir fails, it's likely a file, not a directory
          isDirectory = false;
        }
      }

      if (isDirectory) {
        await webContainer.fs.rm(path, { recursive: true });
      } else {
        await webContainer.fs.rm(path);
      }
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to delete: ${errorMessage}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [webContainer]);

  /**
   * Create a new file
   */
  const createFile = useCallback(async (path: string, content: string = ''): Promise<boolean> => {
    if (!webContainer) {
      setError('WebContainer not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Make sure the parent directory exists
      const dirPath = path.substring(0, path.lastIndexOf('/'));
      if (dirPath) {
        await webContainer.fs.mkdir(dirPath, { recursive: true });
      }
      
      // Write the file
      await webContainer.fs.writeFile(path, content);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to create file: ${errorMessage}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [webContainer]);

  /**
   * Build a file system tree from a directory
   */
  const buildFileTree = useCallback(async (dir: string = '/'): Promise<WebContainerFileSystemTree[]> => {
    if (!webContainer) {
      setError('WebContainer not available');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      // Define our own file tree structure that's compatible with the component
      interface FSTreeNode {
        name: string;
        path: string;
        isDirectory: boolean;
        children?: FSTreeNode[];
      }

      // Helper function to recursively build tree
      const buildTree = async (currentDir: string): Promise<FSTreeNode[]> => {
        const entries: FSTreeNode[] = [];
        
        try {
          const dirEntries = await webContainer.fs.readdir(currentDir, { withFileTypes: true });
          
          for (const entry of dirEntries) {
            const path = `${currentDir === '/' ? '' : currentDir}/${entry.name}`;
            
            if (entry.isDirectory()) {
              const children = await buildTree(path);
              entries.push({
                name: entry.name,
                path,
                isDirectory: true,
                children
              });
            } else {
              entries.push({
                name: entry.name,
                path,
                isDirectory: false
              });
            }
          }
        } catch (err) {
          console.error(`Error reading directory ${currentDir}:`, err);
        }
        
        return entries.sort((a, b) => {
          // Directories first, then alphabetical
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
      };
      
      return await buildTree(dir) as unknown as WebContainerFileSystemTree[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to build file tree: ${errorMessage}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [webContainer]);

  return {
    loadFile,
    saveFile,
    createDirectory,
    deleteFileOrDir,
    createFile,
    buildFileTree,
    error,
    isLoading
  };
} 