import React, {
  useState,
  useEffect,
  useCallback,
  startTransition,
  FC,
} from "react";
import { WebContainer, FileSystemTree as WebContainerFileSystemTree } from "@webcontainer/api";
import { useFileOperations } from "@/wmcp/components/filesystem/useFileOperations";
import { FileSystemTree } from "@/wmcp/components/filesystem/FileSystemTree";
import { LoadingIndicator } from "@/wmcp/components";

// Define FSEntry, matching what's used by FileSystemTree
export interface FSEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FSEntry[];
}

interface ExplorerPaneProps {
  webContainer?: WebContainer | null;
  onSelectFile: (paths: string[]) => void;
  selectedPaths: string[];
}

export const ExplorerPane: FC<ExplorerPaneProps> = React.memo(
  function ExplorerPane({ webContainer, onSelectFile, selectedPaths }) {
    const { buildFileTree } = useFileOperations(webContainer || null);
    const [fileTree, setFileTree] = useState<FSEntry[]>([]);
    const [expandedPathsState, setExpandedPathsState] = useState<string[]>([
      "/",
    ]);
    const [isManuallyRefreshing, setIsManuallyRefreshing] = useState(false);

    const refreshFiles = useCallback(
      async (isManualRefresh = false) => {
        if (!webContainer) {
          console.warn(
            "ExplorerPane: WebContainer not available, cannot refresh files."
          );
          startTransition(() => {
            setFileTree([]);
          });
          if (isManualRefresh) setIsManuallyRefreshing(false);
          return;
        }
        if (isManualRefresh) {
          setIsManuallyRefreshing(true);
        }
        try {
          const tree = await buildFileTree();
          startTransition(() => {
            // Cast the WebContainerFileSystemTree to FSEntry as they have the same structure
            setFileTree(tree as unknown as FSEntry[]);
            setExpandedPathsState((prevPaths) => {
              const newPaths = new Set(prevPaths);
              newPaths.add("/"); // Ensure root is always present and expanded
              return Array.from(newPaths);
            });
          });
        } catch (err) {
          console.error("Error building file tree in ExplorerPane:", err);
        } finally {
          if (isManualRefresh) {
            setIsManuallyRefreshing(false);
          }
        }
      },
      [webContainer, buildFileTree]
    );

    useEffect(() => {
      // Initial load and when webContainer instance changes
      if (webContainer) {
        refreshFiles(false);
      } else {
        // Clear files if webContainer becomes unavailable
        startTransition(() => {
         setFileTree([]);
        });
      }
    }, [webContainer, refreshFiles]);

    const handleAutoRefresh = useCallback(() => {
      // This is called by FileSystemTree's internal timer
      refreshFiles(false);
    }, [refreshFiles]);

    return (
      <>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-2 flex items-center justify-between bg-[#252526]">
          <span>Explorer</span>
          <div className="flex space-x-1">
            <button
              className="hover:bg-[#3c3c3c] rounded p-1 focus:outline-none"
              onClick={() => refreshFiles(true)}
              title="Refresh explorer"
              disabled={isManuallyRefreshing || !webContainer}
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
          {isManuallyRefreshing ? (
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
                expandedPaths={expandedPathsState}
                onSelectionChange={onSelectFile}
                onExpandedChange={setExpandedPathsState}
                onRefresh={handleAutoRefresh}
                refreshInterval={5000}
                showAutoRefreshIndicator={true}
              />
            </div>
          )}
        </div>
      </>
    );
  }
); 