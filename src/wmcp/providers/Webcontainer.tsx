"use client";

import { WebContainer } from "@webcontainer/api";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { FileSystemTree } from "@webcontainer/api";
import { files } from "virtual:webcontainer-files";
import { requestRelayManager } from "../lib/RequestRelayUtils";

type WebContainerStatus = "booting" | "installing" | "mounting" | "ready" | "none" | "error";

// Extend the context to include both the WebContainer and filesystem registry functions
interface WebContainerContextValue {
  webContainer: WebContainer | null;
  registerFilesystem: (id: string, filesystem: FileSystemTree) => void;
  unregisterFilesystem: (id: string) => void;
  filesystemIds: string[]; // Add a property to see registered filesystems
  status: WebContainerStatus;
  portForwards: Record<number, string>;
  generateProxyUrl: (port: number, path?: string) => string;
}

export const WebContainerContext = createContext<WebContainerContextValue>({
  webContainer: null,
  registerFilesystem: () => {},
  unregisterFilesystem: () => {},
  filesystemIds: [],
  status: "none",
  portForwards: {},
  generateProxyUrl: () => ""
});

const crossOriginIsolatedErrorMessage = `Failed to execute 'postMessage' on 'Worker': SharedArrayBuffer transfer requires self.crossOriginIsolated.`;

export default function WebContainerProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
    const [webContainerStatus, setWebContainerStatus] = useState<WebContainerStatus>("none");
    const [portForwards, setPortForwards] = useState<Record<number, string>>({});
    const ready = webContainerStatus === "ready";
    
    // Track registered filesystem trees
    const filesystemsRef = useRef<Record<string, FileSystemTree>>({});
    const [filesystemIds, setFilesystemIds] = useState<string[]>([]);
    
    // Helper function to write filesystem files directly
    const writeFilesystemDirectly = async (container: WebContainer, filesystem: FileSystemTree) => {
      try {
        console.log(`Writing filesystem directly:`, filesystem);
        console.log(`Filesystem object keys:`, Object.keys(filesystem));
        
        // Process each entry in the filesystem
        for (const path in filesystem) {
          const entry = filesystem[path];
          console.log(`Processing entry: ${path}, type:`, 'directory' in entry ? 'directory' : 'file');
          
          if ('directory' in entry) {
            // Create directory
            try {
              await container.fs.mkdir(path, { recursive: true });
              console.log(`Created directory: ${path}`);
              
              // List contents after creating directory
              const dirContents = await container.fs.readdir(path);
              console.log(`Contents of ${path} after creation:`, dirContents);
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
        
        // Convert the filesystem structure to the expected format
        const processedFS: FileSystemTree = {};
        
        // Process each entry to ensure proper paths
        for (const key in filesystem) {
          const entry = filesystem[key];
          const path = key.startsWith('/') ? key : `/${key}`;
          processedFS[path] = entry;
        }
        
        console.log(`Processed filesystem:`, processedFS);
        
        // First try using the mount API
        try {
          // Use proper type casting for the WebContainer API
          await container.mount(processedFS as any);
          console.log(`Successfully mounted filesystem: ${id} via mount API`);
          return true;
        } catch (mountError) {
          console.warn(`Mount API failed for ${id}, falling back to direct file writing:`, mountError);
          
          // If mount fails, fallback to direct file writing
          const success = await writeFilesystemDirectly(container, processedFS);
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
      if (webContainerStatus !== "booting" && webContainerStatus !== "none" && webContainer) {
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
        if (webContainerStatus === "none") {
            setWebContainerStatus("booting");
            console.log("Booting WebContainer...");
            
            WebContainer.boot()
                .then(async (webContainer) => {
                    setWebContainerStatus("mounting");

                    console.log("WebContainer booted successfully");
                    setWebContainer(webContainer);

                    if (process.env.NODE_ENV === "development") {
                      // @ts-expect-error
                      window.webcontainer = webContainer;
                      // @ts-expect-error
                      window.wc = webContainer;
                    }
                    
                    webContainer.on('server-ready', (port, url) => {
                        console.log(`Server ready on port ${port}: ${url}`);
                        setPortForwards((prev) => {
                            const newPortForwards = {...prev, [port]: url};
                            
                            // Update request relay manager with new port mapping
                            requestRelayManager.updatePortMapping(port, url);
                            
                            return newPortForwards;
                        });
                    });
                    
                    // Write files directly to WebContainer
                    console.log("Writing files directly to WebContainer...");
                    
                    if (files && Object.keys(files).length > 0) {
                        try {
                            // Process each file manually
                            for (const filename of Object.keys(files)) {
                                const entry = files[filename];
                                const path = `/${filename}`;
                                
                                console.log(`Processing direct write for: ${path}`);
                                
                                if ('directory' in entry) {
                                    // Create directory
                                    try {
                                        await webContainer.fs.mkdir(path, { recursive: true });
                                        console.log(`Created directory: ${path}`);
                                    } catch (err) {
                                        console.error(`Error creating directory ${path}:`, err);
                                    }
                                    
                                    // Recursively process directory contents using helper function
                                    await writeDirectoryContents(webContainer, path, entry.directory);
                                } else if ('file' in entry && 'contents' in entry.file) {
                                    // Write file
                                    try {
                                        await webContainer.fs.writeFile(path, entry.file.contents);
                                        console.log(`Created file: ${path}`);
                                    } catch (err) {
                                        console.error(`Error writing file ${path}:`, err);
                                    }
                                }
                            }
                            console.log("Direct file writing complete");
                            
                            // Run npm install after files are written
                            setWebContainerStatus("installing");
                            await new Promise(resolve => setTimeout(resolve, 1));
                            console.log("Running npm install...");
                            try {
                                const installProcess = await webContainer.spawn('pnpm', ['install']);
                                installProcess.output.pipeTo(new WritableStream({
                                    write(data) {
                                        console.log(`[npm install] ${data}`);
                                    }
                                }));
                                const installExitCode = await installProcess.exit;
                                setWebContainerStatus("ready");
                                console.log(`npm install completed with exit code ${installExitCode}`);
                            } catch (error) {
                                setWebContainerStatus("error");
                                console.error("Error running npm install:", error);
                            }
                        } catch (error) {
                            console.error("Error writing files directly:", error);
                        }
                        
                        // Helper function to recursively write directory contents
                        async function writeDirectoryContents(container: WebContainer, basePath: string, dirContents: Record<string, any>) {
                            for (const name in dirContents) {
                                const entry = dirContents[name];
                                const fullPath = `${basePath}/${name}`;
                                
                                if ('directory' in entry) {
                                    try {
                                        await container.fs.mkdir(fullPath, { recursive: true });
                                        console.log(`Created nested directory: ${fullPath}`);
                                        
                                        // Recursively handle subdirectories
                                        await writeDirectoryContents(container, fullPath, entry.directory);
                                    } catch (err) {
                                        console.error(`Error creating nested directory ${fullPath}:`, err);
                                    }
                                } else if ('file' in entry) {
                                    try {
                                        await container.fs.writeFile(fullPath, entry.file.contents);
                                        console.log(`Created nested file: ${fullPath}`);
                                    } catch (err) {
                                        console.error(`Error writing nested file ${fullPath}:`, err);
                                    }
                                }
                            }
                        }
                    } else {
                        console.warn("No files to write to WebContainer");
                    }
                    
                    // Apply registered filesystems
                    // console.log("Applying other registered filesystems...");
                    // await applyFilesystems();
                    
                    // // List files in the WebContainer to verify they were mounted
                    // setTimeout(async () => {
                    //     try {
                    //         console.log("Listing files in WebContainer root:");
                    //         const rootFiles = await webContainer.fs.readdir("/");
                    //         console.log("Root files:", rootFiles);
                            
                    //         // Check specific files we expect to be there
                    //         try {
                    //             const hasPackageJson = await webContainer.fs.readFile("/package.json", "utf-8");
                    //             console.log("Found package.json:", hasPackageJson.substring(0, 100) + "...");
                    //         } catch (err) {
                    //             console.error("Error reading package.json:", err);
                    //         }
                            
                    //         try {
                    //             const hasTsConfig = await webContainer.fs.readFile("/tsconfig.json", "utf-8");
                    //             console.log("Found tsconfig.json:", hasTsConfig.substring(0, 100) + "...");
                    //         } catch (err) {
                    //             console.error("Error reading tsconfig.json:", err);
                    //         }
                            
                    //         // Check each subdirectory
                    //         for (const file of rootFiles) {
                    //             try {
                    //                 // Try to read the directory - if it succeeds, it's a directory
                    //                 const subFiles = await webContainer.fs.readdir(`/${file}`);
                    //                 console.log(`Files in /${file}:`, subFiles);
                    //             } catch (err) {
                    //                 // Not a directory or other error
                    //                 console.log(`${file} is not a directory or cannot be read`);
                    //             }
                    //         }
                    //     } catch (err) {
                    //         console.error("Error listing WebContainer files:", err);
                    //     }
                    // }, 1000);
                })
                .catch((error) => {
                    console.error("Error booting WebContainer:", error);
                    setWebContainerStatus("error");

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
                setWebContainerStatus("none");
            }
        };
    }, [ready, webContainer, webContainerStatus]);

    // Effect to sync port forwards with request relay manager
    useEffect(() => {
        if (Object.keys(portForwards).length > 0) {
            const mappings = Object.entries(portForwards).map(([port, url]) => ({
                port: parseInt(port),
                url,
                appId: `app-${port}`
            }));
            
            requestRelayManager.updatePortMappings(mappings);
        }
    }, [portForwards]);

    const contextValue = {
      webContainer,
      registerFilesystem,
      unregisterFilesystem,
      filesystemIds,
      status: webContainerStatus,
      portForwards,
      generateProxyUrl: (port: number, path?: string) => requestRelayManager.generateProxyUrl(port, path)
    };

    return (
        <WebContainerContext.Provider value={contextValue}>
            {children}
        </WebContainerContext.Provider>
    );
}
