import { useContext, useRef, useEffect } from "react";
import { WebContainerContext } from "../providers/Webcontainer";
import { FileSystemTree } from "@webcontainer/api";


export function useWebContainer(filesystem?: FileSystemTree) {
    const { webContainer, registerFilesystem, unregisterFilesystem } = useContext(WebContainerContext);
    
    // Use the instance ID to track this specific hook call
    const instanceIdRef = useRef<string>(`fs-${Math.random().toString(36).substr(2, 9)}`);
    
    // Register the filesystem when provided and when the hook mounts
    useEffect(() => {
        if (filesystem) {
            console.log(`useWebContainer: Registering filesystem ${instanceIdRef.current}`);
            registerFilesystem(instanceIdRef.current, filesystem);
            
            // Clean up when the component unmounts
            return () => {
                console.log(`useWebContainer: Unregistering filesystem ${instanceIdRef.current}`);
                unregisterFilesystem(instanceIdRef.current);
            };
        }
    }, [filesystem, registerFilesystem, unregisterFilesystem]);

    return webContainer;
}