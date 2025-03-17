"use client";

import { WebContainer } from "@webcontainer/api";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { FileSystemTree } from "@webcontainer/api";

type WebContainerState = "booting" | "ready" | "none";

// Extend the context to include both the WebContainer and filesystem registry functions
interface WebContainerContextValue {
  webContainer: WebContainer | null;
  registerFilesystem: (id: string, filesystem: FileSystemTree) => void;
  unregisterFilesystem: (id: string) => void;
  filesystemIds: string[]; // Add a property to see registered filesystems
}

export const WebContainerContext = createContext<WebContainerContextValue>({
  webContainer: null,
  registerFilesystem: () => {},
  unregisterFilesystem: () => {},
  filesystemIds: [],
});

const crossOriginIsolatedErrorMessage = `Failed to execute 'postMessage' on 'Worker': SharedArrayBuffer transfer requires self.crossOriginIsolated.`;

export default function WebContainerProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
    const webContainerStatus = useRef<WebContainerState>("none");
    const [portForwards, setPortForwards] = useState<Record<number, string>>({});
    const ready = webContainerStatus.current === "ready";
    
    // Track registered filesystem trees
    const filesystemsRef = useRef<Record<string, FileSystemTree>>({});
    const [filesystemIds, setFilesystemIds] = useState<string[]>([]);
    
    // Helper function to write filesystem files directly
    const writeFilesystemDirectly = async (container: WebContainer, filesystem: FileSystemTree) => {
      try {
        console.log(`Writing filesystem directly:`, filesystem);
        
        // Process each entry in the filesystem
        for (const path in filesystem) {
          const entry = filesystem[path];
          
          if ('directory' in entry) {
            // Create directory
            try {
              await container.fs.mkdir(path, { recursive: true });
              console.log(`Created directory: ${path}`);
            } catch (err) {
              console.error(`Error creating directory ${path}:`, err);
            }
          } else if ('file' in entry) {
            // Create parent directory if needed
            const parentDir = path.substring(0, path.lastIndexOf('/'));
            if (parentDir) {
              try {
                await container.fs.mkdir(parentDir, { recursive: true });
              } catch (err) {
                // Ignore errors, directory might already exist
              }
            }
            
            // Write file
            try {
              // @ts-expect-error
              await container.fs.writeFile(path, entry.file.contents);
              console.log(`Created file: ${path}`);
            } catch (err) {
              console.error(`Error writing file ${path}:`, err);
            }
          }
        }
        
        return true;
      } catch (error) {
        console.error(`Error writing filesystem directly:`, error);
        return false;
      }
    };
    
    // Helper function to mount a filesystem with better type handling
    const mountFilesystem = async (container: WebContainer, filesystem: FileSystemTree, id: string) => {
      try {
        console.log(`Mounting filesystem: ${id}`, filesystem);
        
        // First try using the mount API
        try {
          // Use proper type casting for the WebContainer API
          await container.mount(filesystem as any);
          console.log(`Successfully mounted filesystem: ${id} via mount API`);
          return true;
        } catch (mountError) {
          console.warn(`Mount API failed for ${id}, falling back to direct file writing:`, mountError);
          
          // If mount fails, fallback to direct file writing
          const success = await writeFilesystemDirectly(container, filesystem);
          if (success) {
            console.log(`Successfully wrote filesystem: ${id} via direct file writing`);
            return true;
          } else {
            console.error(`Failed to write filesystem: ${id} directly`);
            return false;
          }
        }
      } catch (error) {
        console.error(`Error handling filesystem ${id}:`, error);
        return false;
      }
    };
    
    // Apply filesystems to WebContainer
    const applyFilesystems = async () => {
      if (!webContainer) return;
      
      const filesystems = filesystemsRef.current;
      console.log(`Applying ${Object.keys(filesystems).length} filesystems`);
      
      for (const id in filesystems) {
        await mountFilesystem(webContainer, filesystems[id], id);
      }
    };
    
    // Register a filesystem tree
    const registerFilesystem = (id: string, filesystem: FileSystemTree) => {
      console.log(`Registering filesystem: ${id}`);
      
      // Update the ref with the new filesystem
      filesystemsRef.current = {
        ...filesystemsRef.current,
        [id]: filesystem
      };
      
      // Update the state with the new ID list
      setFilesystemIds(Object.keys(filesystemsRef.current));
      
      // If the container is already ready, apply the filesystem immediately
      if (webContainerStatus.current === "ready" && webContainer) {
        mountFilesystem(webContainer, filesystem, id);
      }
    };
    
    // Unregister a filesystem tree
    const unregisterFilesystem = (id: string) => {
      console.log(`Unregistering filesystem: ${id}`);
      
      const { [id]: _, ...rest } = filesystemsRef.current;
      filesystemsRef.current = rest;
      
      // Update the state with the new ID list
      setFilesystemIds(Object.keys(filesystemsRef.current));
    };

    useEffect(() => {
        if (webContainerStatus.current === "none") {
            webContainerStatus.current = "booting";
            console.log("Booting WebContainer...");
            
            WebContainer.boot()
                .then((webContainer) => {
                    console.log("WebContainer booted successfully");
                    setWebContainer(webContainer);
                    webContainerStatus.current = "ready";
                    
                    webContainer.on('server-ready', (port, url) => {
                        console.log(`Server ready on port ${port}: ${url}`);
                        setPortForwards((prev) => ({...prev, [port]: url}));
                    });
                    
                    // Apply all registered filesystems once the container is ready
                    console.log("Applying registered filesystems...");
                    applyFilesystems();
                })
                .catch((error) => {
                    console.error("Error booting WebContainer:", error);
                    
                    if (!(error instanceof Error)) return;
                    if (error.message === crossOriginIsolatedErrorMessage) {
                        error.message += `\n\nSee https://webcontainers.io/guides/quickstart#cross-origin-isolation for more information.
              \nTo fix this error, please set the following headers in your server:\nCross-Origin-Embedder-Policy: require-corp\nCross-Origin-Opener-Policy: same-origin`;
                        throw error;
                    }
                });
        }

        return () => {
            if (ready) {
                console.log("Tearing down WebContainer");
                webContainer?.teardown();
                webContainerStatus.current = "none";
            }
        };
    }, [ready, webContainer]);

    const contextValue = {
      webContainer,
      registerFilesystem,
      unregisterFilesystem,
      filesystemIds
    };

    return (
        <WebContainerContext.Provider value={contextValue}>
            {children}
        </WebContainerContext.Provider>
    );
}
