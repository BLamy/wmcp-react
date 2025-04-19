"use client";

import { ServerConfig } from "../lib/McpClientManager";
import { useWebContainer } from "./useWebcontainer";
import { useState, useEffect, useRef } from "react";
import { MCPClientManager } from "../lib/McpClientManager";
import { Tool, Resource } from "@modelcontextprotocol/sdk/types.js";
export type MCPServerStatus = 'NO_WEBCONTAINER_CONTEXT' | 'INSTALLING_NODE_MODULES' | 'STARTING' | 'READY' | 'RESTARTING' | 'ERROR';

// export interface Resource {
//   name: string;
//   uri: string;
//   description?: string;
//   metadata?: Record<string, any>;
// }

// export interface ToolDefinition {
//   name: string;
//   description: string;
//   inputSchema?: any;
//   outputSchema?: any;
// }

export interface ReadResourceResponse {
  contents: {
    text: string;
    [key: string]: any;
  }[];
  [key: string]: any;
}

export function useMCPServer(props: { mcpServers: Record<string, ServerConfig> }) {
    const webContainer = useWebContainer();
    const [status, setStatus] = useState<MCPServerStatus>('NO_WEBCONTAINER_CONTEXT');
    const [error, setError] = useState<Error | undefined>(undefined);
    const [prompts, setPrompts] = useState<any[]>([]);
    const [tools, setTools] = useState<Tool[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [capabilities, setCapabilities] = useState<any>({});
    
    // Ref to the client manager
    const clientManagerRef = useRef<MCPClientManager | null>(null);
    
    // Initialize the client manager
    useEffect(() => {
      if (!webContainer) {
        console.warn('MCP Server: No WebContainer context available');
        setStatus('NO_WEBCONTAINER_CONTEXT');
        return;
      }
      
      // Only proceed if we have servers configured
      if (Object.keys(props.mcpServers).length === 0) {
        console.log('MCP Server: No servers configured, skipping initialization');
        return;
      }
      
      console.log('MCP Server: Starting initialization with configs:', props.mcpServers);
      setStatus('STARTING');
      
      // Add a delay to ensure WebContainer is fully initialized
      const delayMs = 2000;
      console.log(`MCP Server: Delaying initialization for ${delayMs}ms to ensure WebContainer is ready`);
      
      const initTimer = setTimeout(async () => {
        try {
          // Create new client manager
          console.log('MCP Server: Creating client manager with WebContainer', webContainer);
          const clientManager = new MCPClientManager(webContainer);
          clientManagerRef.current = clientManager;
          
          // Initialize with retries
          let success = false;
          let attempt = 0;
          const maxAttempts = 3;
          
          while (!success && attempt < maxAttempts) {
            attempt++;
            console.log(`MCP Server: Initialization attempt ${attempt}/${maxAttempts}`);
            
            try {
              // Initialize with modified server configs
              console.log('MCP Server: Attempting to initialize with server configs', props.mcpServers);
              await clientManager.initialize({ ...props.mcpServers });
              success = true;
            } catch (initError) {
              console.error(`MCP Server: Initialization attempt ${attempt} failed:`, initError);
              
              if (attempt === maxAttempts) {
                throw initError;
              }
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
          if (success) {
            // Load initial data
            console.log('MCP Server: Server initialized successfully, loading tools and resources');
            try {
              const toolsList = await clientManager.listAllTools();
              console.log('MCP Server: Loaded tools:', toolsList);
              setTools(toolsList);
            } catch (toolsError) {
              console.warn('MCP Server: Failed to load tools:', toolsError);
              // Continue even if tools fail to load
            }
            
            try {
              const resourcesList = await clientManager.listAllResources();
              console.log('MCP Server: Loaded resources:', resourcesList);
              setResources(resourcesList);
            } catch (resourcesError) {
              console.warn('MCP Server: Failed to load resources:', resourcesError);
              // Continue even if resources fail to load
            }
            
            setStatus('READY');
            console.log('MCP Server: Initialization complete, status set to READY');
          }
        } catch (err) {
          console.error('MCP Server: Failed to initialize client manager:', err);
          let errorMessage = 'Unknown error initializing MCP servers';
          
          if (err instanceof Error) {
            console.error('MCP Server: Error details:', err.message);
            console.error('MCP Server: Error stack:', err.stack);
            errorMessage = err.message;
            setError(err);
          } else {
            setError(new Error(errorMessage));
          }
          
          // Make the error more user-friendly
          if (errorMessage.includes('ENOENT')) {
            errorMessage = 'Server executable not found. The MPC server package may not be installed.';
          } else if (errorMessage.includes('EACCES')) {
            errorMessage = 'Permission denied when starting the server.';
          } else if (errorMessage.includes('timeout')) {
            errorMessage = 'Server connection timed out. The server may be taking too long to start.';
          }
          
          console.error('MCP Server: User-friendly error:', errorMessage);
          setStatus('ERROR');
        }
      }, delayMs);
      
      // Cleanup function
      return () => {
        console.log('MCP Server: Cleaning up initialization');
        clearTimeout(initTimer);
        
        console.log('MCP Server: Disconnecting servers if connected');
        if (clientManagerRef.current) {
          clientManagerRef.current.disconnectAll().catch(err => {
            console.error('MCP Server: Error disconnecting MPC servers:', err);
          });
        }
      };
    }, [webContainer, props.mcpServers]);
    
    // Functions for interacting with MCP server
    const executePrompt = async (promptId: string, variables?: Record<string, any>) => {
      if (!clientManagerRef.current || status !== 'READY') {
        throw new Error('MCP Client Manager is not ready');
      }
      
      try {
        // This is a placeholder - actual implementation would depend on your MCP server
        return { success: true, promptId, variables };
      } catch (err) {
        console.error(`Error executing prompt ${promptId}:`, err);
        throw err;
      }
    };
    
    const executeTool = async (toolName: string, args: any) => {
      if (!clientManagerRef.current || status !== 'READY') {
        throw new Error('MCP Client Manager is not ready');
      }
      
      try {
        return await clientManagerRef.current.callTool(toolName, args);
      } catch (err) {
        console.error(`Error executing tool ${toolName}:`, err);
        throw err;
      }
    };
    
    const fetchResource = async (resourceUri: string) => {
      if (!clientManagerRef.current || status !== 'READY') {
        throw new Error('MCP Client Manager is not ready');
      }
      
      try {
        return await clientManagerRef.current.readResource(resourceUri);
      } catch (err) {
        console.error(`Error fetching resource ${resourceUri}:`, err);
        throw err;
      }
    };
    
    const refreshPrompts = async () => {
      // This is a placeholder - actual implementation would depend on your MCP server
      return prompts;
    };
    
    const refreshTools = async () => {
      if (!clientManagerRef.current || status !== 'READY') {
        throw new Error('MCP Client Manager is not ready');
      }
      
      try {
        const toolsList = await clientManagerRef.current.listAllTools();
        setTools(toolsList);
        return toolsList;
      } catch (err) {
        console.error('Error refreshing tools:', err);
        throw err;
      }
    };
    
    const refreshResources = async () => {
      if (!clientManagerRef.current || status !== 'READY') {
        throw new Error('MCP Client Manager is not ready');
      }
      
      try {
        const resourcesList = await clientManagerRef.current.listAllResources();
        setResources(resourcesList);
        return resourcesList;
      } catch (err) {
        console.error('Error refreshing resources:', err);
        throw err;
      }
    };
    
    return {
      status,
      error,
      prompts,
      tools,
      resources,
      capabilities,
      executePrompt,
      executeTool,
      fetchResource,
      refreshPrompts,
      refreshTools,
      refreshResources,
      // Expose the toolToServerMap to allow components to access the mapping
      toolToServerMap: clientManagerRef.current ? clientManagerRef.current.toolToServerMap : undefined
    };
  }