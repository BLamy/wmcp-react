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
        setStatus('NO_WEBCONTAINER_CONTEXT');
        return;
      }
      
      setStatus('STARTING');
      
      const initializeClientManager = async () => {
        try {
          // Create new client manager
          const clientManager = new MCPClientManager(webContainer);
          clientManagerRef.current = clientManager;
          
          // Initialize with modified server configs
          await clientManager.initialize({ ...props.mcpServers });
          
          // Load initial data
          const toolsList = await clientManager.listAllTools();
          const resourcesList = await clientManager.listAllResources();
          
          setTools(toolsList);
          setResources(resourcesList);
          setStatus('READY');
        } catch (err) {
          console.error('Failed to initialize MCP Client Manager:', err);
          setError(err as Error);
          setStatus('ERROR');
        }
      };
      
      initializeClientManager();
      
      // Cleanup function
      return () => {
        if (clientManagerRef.current) {
          clientManagerRef.current.disconnectAll().catch(err => {
            console.error('Error disconnecting MCP servers:', err);
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