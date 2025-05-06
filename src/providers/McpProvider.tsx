import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { WebContainerContext } from '@/wmcp/providers/Webcontainer';
import {
  MCPClientManager,
  ServerConfig,
} from '@/wmcp/lib/McpClientManager';
import type {
  Tool,
  Resource,
} from '@modelcontextprotocol/sdk/types.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/*
  McpProvider is a context wrapper responsible for managing Model-Context-Protocol
  servers inside a WebContainer.  It exposes helper functions to activate/
  deactivate servers, list & execute tools, and read resources.
*/

export type MCPServerStatus =
  | 'IDLE'
  | 'NO_WEBCONTAINER_CONTEXT'
  | 'STARTING'
  | 'READY'
  | 'ERROR';

// Default server configs.  These mirror the ones used previously in Cursor.tsx.
export const DEFAULT_SERVER_CONFIGS: Record<string, ServerConfig> = {
  memory: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {},
  },
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
    env: {},
  },
  'sequential-thinking': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    env: {},
  },
  everything: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    env: {},
  },
};

interface McpContextValue {
  status: MCPServerStatus;
  error?: Error;
  tools: Tool[];
  resources: Resource[];
  prompts: any[]; // Placeholder – prompts are not yet surfaced
  activeServers: Record<string, ServerConfig>;
  availableServers: Record<string, ServerConfig>;
  toolToServerMap: Map<string, string>;
  webContainerReady: boolean;
  activateServer: (name: string) => void;
  deactivateServer: (name: string) => void;
  addCustomServer: (name: string, cfg: ServerConfig) => void;
  executeTool: (name: string, args: any) => Promise<any>;
  readResource: (uri: string) => Promise<ReadResourceResult>;
  refreshTools: () => Promise<void>;
  refreshResources: () => Promise<void>;
  refreshPrompts: () => Promise<void>;
}

const McpContext = createContext<McpContextValue | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  initialActiveServers?: Record<string, ServerConfig>;
  initialAvailableServers?: Record<string, ServerConfig>;
}

export function McpProvider({
  children,
  initialActiveServers = {},
  initialAvailableServers = DEFAULT_SERVER_CONFIGS,
}: ProviderProps) {
  const { webContainer, status: wcStatus } = useContext(WebContainerContext);
  const webContainerReady = wcStatus === 'ready';

  // State
  const [activeServers, setActiveServers] = useState<Record<string, ServerConfig>>(initialActiveServers);
  const [availableServers, setAvailableServers] = useState<Record<string, ServerConfig>>(initialAvailableServers);
  const [status, setStatus] = useState<MCPServerStatus>('IDLE');
  const [error, setError] = useState<Error | undefined>(undefined);
  const [tools, setTools] = useState<Tool[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [toolToServerMap, setToolToServerMap] = useState<Map<string, string>>(new Map());

  const managerRef = useRef<MCPClientManager | null>(null);
  const initializingRef = useRef(false);

  const debouncedActiveServers = useDebounce(activeServers, 500);

  // Core effect – (re)initialise manager whenever WC or server set changes.
  useEffect(() => {
    const initialize = async () => {
      if (!webContainer) {
        setStatus('NO_WEBCONTAINER_CONTEXT');
        return;
      }
      if (!webContainerReady) {
        setStatus('IDLE');
        return;
      }

      const currentServers = debouncedActiveServers;
      const serverCount = Object.keys(currentServers).length;

      // Disconnect if none active
      if (serverCount === 0) {
        if (managerRef.current) {
          await managerRef.current.disconnectAll();
          managerRef.current = null;
        }
        setTools([]);
        setResources([]);
        setPrompts([]);
        setToolToServerMap(new Map());
        setStatus('IDLE');
        return;
      }

      // Avoid concurrent initialisations
      if (initializingRef.current) return;
      initializingRef.current = true;

      try {
        setStatus('STARTING');
        setError(undefined);

        if (!managerRef.current) {
          managerRef.current = new MCPClientManager(webContainer);
        } else {
          await managerRef.current.disconnectAll();
        }

        await managerRef.current.initialize({ ...currentServers });
        await refreshTools();
        await refreshResources();
        setToolToServerMap(new Map(managerRef.current.toolToServerMap));
        setStatus('READY');
      } catch (err: any) {
        console.error('McpProvider initialise error', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('ERROR');
        if (managerRef.current) {
          await managerRef.current.disconnectAll();
          managerRef.current = null;
        }
        setTools([]);
        setResources([]);
        setToolToServerMap(new Map());
      } finally {
        initializingRef.current = false;
      }
    };

    initialize();
  }, [webContainer, webContainerReady, debouncedActiveServers]);

  // ---- action helpers ---------------------------------------------------
  const activateServer = useCallback(
    (name: string) => {
      if (!availableServers[name]) return;
      setActiveServers((prev) => ({ ...prev, [name]: availableServers[name] }));
    },
    [availableServers],
  );

  const deactivateServer = useCallback((name: string) => {
    setActiveServers((prev) => {
      const { [name]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const addCustomServer = useCallback((name: string, cfg: ServerConfig) => {
    setAvailableServers((prev) => ({ ...prev, [name]: cfg }));
  }, []);

  const executeTool = useCallback(async (toolName: string, args: any) => {
    if (status !== 'READY' || !managerRef.current) {
      throw new Error('MCP not ready');
    }
    return managerRef.current.callTool(toolName, args);
  }, [status]);

  const readResource = useCallback(async (uri: string): Promise<ReadResourceResult> => {
    if (status !== 'READY' || !managerRef.current) {
      throw new Error('MCP not ready');
    }
    return managerRef.current.readResource(uri);
  }, [status]);

  const refreshTools = useCallback(async () => {
    if (status !== 'READY' || !managerRef.current) return;
    const list = await managerRef.current.listAllTools();
    setTools(list);
    setToolToServerMap(new Map(managerRef.current.toolToServerMap));
  }, [status]);

  const refreshResources = useCallback(async () => {
    if (status !== 'READY' || !managerRef.current) return;
    const list = await managerRef.current.listAllResources();
    setResources(list);
  }, [status]);

  const refreshPrompts = useCallback(async () => {
    // Placeholder – implement when MCP supports prompt listing
    setPrompts([]);
  }, []);

  // ---- provide context --------------------------------------------------
  const value: McpContextValue = {
    status,
    error,
    tools,
    resources,
    prompts,
    activeServers,
    availableServers,
    toolToServerMap,
    webContainerReady,
    activateServer,
    deactivateServer,
    addCustomServer,
    executeTool,
    readResource,
    refreshTools,
    refreshResources,
    refreshPrompts,
  };

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>;
}

export function useMcp(): McpContextValue {
  const ctx = useContext(McpContext);
  if (!ctx) throw new Error('useMcp must be used inside McpProvider');
  return ctx;
}

// -------------------------------------------------------------------------
// util – simple debounce for object values
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
} 