"use client";
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useContext } from "react";
import {
  SendIcon,
  BotIcon,
  UserIcon,
  Wrench,
  ChevronDown,
  ChevronUp,
  Loader2,
  PlusIcon,
  ImageIcon,
  Settings,
  X,
  Server,
  AlertCircle,
  SlashIcon,
  AtSignIcon,
  FileIcon,
  FolderIcon,
  Sparkles
} from "lucide-react";
import { FileTrigger, Button as AriaButton } from 'react-aria-components';
import { MenuTrigger, Modal, ModalOverlay, Dialog, Heading } from 'react-aria-components';
import { animate, motion } from "framer-motion";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandDialog
} from "@/components/ui/command";
import {
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  useWebContainerAgent,
  Message,
  AnthropicMessage,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TOOLS,
  UserTextMessage,
  AssistantTextMessage,
  ToolCallMessage,
  ToolResultMessage,
  ToolCall,
  ToolResult,
  ContentBlock
} from "./useWebContainerAgent";
import { ServerConfig } from "../../wmcp/lib/McpClientManager";
import { MCPServerStatus, useMCPServer } from "../../wmcp/hooks/useMcpServer";
import { Tool } from "@modelcontextprotocol/sdk/types";
import { WebContainerContext } from "../../wmcp/providers/Webcontainer";
import { MpcServerMenu } from "../../components/MpcServerMenu";
import { PromptMenu, Prompt } from "../../components/PromptMenu";
import { ResourceMenu, Resource } from "../../components/ResourceMenu";

// Default MPC server configurations
const DEFAULT_SERVER_CONFIGS: Record<string, ServerConfig> = {
  'memory': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {}
  },
  'filesystem': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
    env: {}
  },
  'sequential-thinking': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    env: {}
  },
  'everything': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    env: {}
  }
};

// Wrap React Aria modal components for framer-motion
const MotionModal = motion(Modal);
const MotionModalOverlay = motion(ModalOverlay);

// Server Config Sheet Component
interface ServerConfigSheetProps {
  availableServers: Record<string, ServerConfig>;
  activeServers: Record<string, ServerConfig>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (selectedServers: Record<string, ServerConfig>) => void;
  serverStatus?: MCPServerStatus | null;
  tools?: Tool[];
  serverToolMapping?: Record<string, string>;
  webContainerReady?: boolean;
}

function ServerConfigSheet({ 
  availableServers, 
  activeServers, 
  isOpen, 
  onOpenChange, 
  onSave,
  serverStatus = null,
  tools = [],
  serverToolMapping = {},
  webContainerReady = false
}: ServerConfigSheetProps) {
  // Track all available servers (default + custom)
  const [serverConfigs, setServerConfigs] = useState<Record<string, ServerConfig>>(availableServers);
  
  // Track which servers are active
  const [activeServerStates, setActiveServerStates] = useState<Record<string, boolean>>({});
  
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [showAddServerForm, setShowAddServerForm] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerCommand, setNewServerCommand] = useState('npx');
  const [newServerArgs, setNewServerArgs] = useState('-y @modelcontextprotocol/server-');

  // Reset selections and server configs when sheet opens
  useEffect(() => {
    if (isOpen) {
      // Initialize with all available configurations
      setServerConfigs({...availableServers});
      
      // Setup which servers are active
      const active: Record<string, boolean> = {};
      
      Object.keys(availableServers).forEach(key => {
        active[key] = !!activeServers[key]; // Only selected ones are active
      });
      
      setActiveServerStates(active);
      setEditingServer(null);
      setShowAddServerForm(false);
    }
  }, [isOpen, availableServers, activeServers]);

  // Get server status indicator color
  const getStatusIndicator = (serverKey: string) => {
    if (!activeServerStates[serverKey]) {
      return "bg-gray-400"; // Idle/Inactive
    }
    
    if (serverStatus === 'READY') {
      return "bg-green-500"; // Ready
    } else if (serverStatus === 'STARTING' || serverStatus === 'INSTALLING_NODE_MODULES') {
      return "bg-yellow-500 animate-pulse"; // Starting or Installing
    } else if (serverStatus === 'ERROR') {
      return "bg-red-500"; // Error
    } else {
      return "bg-gray-500"; // Unknown state
    }
  };

  // Get server status text
  const getStatusText = (serverKey: string) => {
    if (!activeServerStates[serverKey]) {
      return "Inactive";
    }
    
    if (serverStatus === 'READY') {
      return "Ready";
    } else if (serverStatus === 'STARTING') {
      return "Starting";
    } else if (serverStatus === 'INSTALLING_NODE_MODULES') {
      return "Installing";
    } else if (serverStatus === 'ERROR') {
      return "Error";
    } else {
      return "Unknown";
    }
  };

  // Toggle server active state
  const handleToggleServerActive = (serverKey: string) => {
    setActiveServerStates(prev => ({
      ...prev,
      [serverKey]: !prev[serverKey]
    }));
  };

  // Handle form submission and save active servers
  const handleSave = () => {
    const selectedServers: Record<string, ServerConfig> = {};
    
    Object.keys(activeServerStates).forEach(key => {
      if (activeServerStates[key]) {
        selectedServers[key] = serverConfigs[key];
      }
    });
    
    onSave(selectedServers);
    onOpenChange(false);
  };

  // Add a new custom server
  const handleAddServer = () => {
    if (!newServerName.trim()) {
      alert('Server name is required');
      return;
    }
    
    // Add the new server configuration
    const newServer: ServerConfig = {
      command: newServerCommand,
      args: newServerArgs.split(' '),
      env: {}
    };
    
    // Update configs and set as active
    setServerConfigs(prev => ({
      ...prev,
      [newServerName]: newServer
    }));
    
    setActiveServerStates(prev => ({
      ...prev,
      [newServerName]: true
    }));
    
    // Reset form
    setNewServerName('');
    setNewServerCommand('npx');
    setNewServerArgs('-y @modelcontextprotocol/server-');
    setShowAddServerForm(false);
  };

  return (
    <MotionModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <MotionModal
        className="bg-[#252526] rounded-lg shadow-lg border border-[#3c3c3c] w-full max-w-md overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <Dialog className="outline-none">
          <div className="p-4 border-b border-[#3c3c3c]">
            <Heading slot="title" className="text-white text-lg font-medium">MPC Servers</Heading>
            <p className="text-gray-400 text-sm mt-1">
              Select which MPC servers to connect to
            </p>
          </div>
          
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {/* WebContainer status warning */}
            {!webContainerReady && (
              <div className="mb-4 p-3 rounded-md bg-red-900/20 border border-red-600/30">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">WebContainer is not ready. MPC servers require a fully initialized WebContainer.</span>
                </div>
              </div>
            )}
            
            {/* Server list */}
            <div className="space-y-3">
              {Object.entries(serverConfigs).map(([key, config]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-md bg-[#1e1e1e] border border-[#3c3c3c]">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusIndicator(key)}`}></div>
                    <div>
                      <div className="text-white font-medium">{key}</div>
                      <div className="text-xs text-gray-400">
                        Status: {getStatusText(key)}
                      </div>
                      {serverStatus === 'ERROR' && activeServerStates[key] && (
                        <div className="text-xs text-red-400 mt-1">
                          There was an error starting this server. Check console for details.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        activeServerStates[key] 
                          ? "bg-blue-600 hover:bg-blue-700 text-white" 
                          : "bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white"
                      }`}
                      onClick={() => handleToggleServerActive(key)}
                    >
                      {activeServerStates[key] ? "Active" : "Inactive"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Add server button */}
            {!showAddServerForm && (
              <button
                className="mt-4 flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
                onClick={() => setShowAddServerForm(true)}
              >
                <PlusIcon className="h-4 w-4" />
                Add Custom Server
              </button>
            )}
            
            {/* Add server form */}
            {showAddServerForm && (
              <div className="mt-4 p-3 rounded-md bg-[#1e1e1e] border border-[#3c3c3c]">
                <h3 className="text-white font-medium mb-2">Add Custom Server</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Server Name</label>
                    <input
                      type="text"
                      value={newServerName}
                      onChange={(e) => setNewServerName(e.target.value)}
                      className="w-full bg-[#3c3c3c] border-0 rounded p-2 text-sm text-white focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g., custom-memory"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Command</label>
                    <input
                      type="text"
                      value={newServerCommand}
                      onChange={(e) => setNewServerCommand(e.target.value)}
                      className="w-full bg-[#3c3c3c] border-0 rounded p-2 text-sm text-white focus:ring-1 focus:ring-blue-500"
                      placeholder="npx"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Arguments</label>
                    <input
                      type="text"
                      value={newServerArgs}
                      onChange={(e) => setNewServerArgs(e.target.value)}
                      className="w-full bg-[#3c3c3c] border-0 rounded p-2 text-sm text-white focus:ring-1 focus:ring-blue-500"
                      placeholder="-y @modelcontextprotocol/server-memory"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      className="px-3 py-1 rounded text-sm bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white"
                      onClick={() => setShowAddServerForm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-3 py-1 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleAddServer}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-[#3c3c3c] flex justify-end gap-2">
            <button
              className="px-4 py-2 rounded text-sm bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </Dialog>
      </MotionModal>
    </MotionModalOverlay>
  );
}

export interface WebContainerAgentProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  apiKey?: string;
  onRequestApiKey?: () => void;
  testResults?: any;
  serverConfigs?: Record<string, ServerConfig>;
  activeServers?: Record<string, ServerConfig>;
  setActiveServers?: React.Dispatch<React.SetStateAction<Record<string, ServerConfig>>>;
}

// Define the handle type for the ref
export interface WebContainerAgentHandle {
  handleClearMessages: () => void;
}

export const WebContainerAgent = React.memo(forwardRef<WebContainerAgentHandle, WebContainerAgentProps>(({ 
  messages, 
  setMessages, 
  apiKey, 
  onRequestApiKey,
  testResults,
  serverConfigs = DEFAULT_SERVER_CONFIGS,
  activeServers = {},
  setActiveServers
}, ref) => {
  const [input, setInput] = useState("");
  const [collapsedTools, setCollapsedTools] = useState<Record<string, boolean>>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isServerConfigOpen, setIsServerConfigOpen] = useState(false);
  const [localActiveServers, setLocalActiveServers] = useState<Record<string, ServerConfig>>(activeServers);
  const [availableServerConfigs, setAvailableServerConfigs] = useState<Record<string, ServerConfig>>(serverConfigs);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [isPromptMenuOpen, setIsPromptMenuOpen] = useState(false);
  const [isResourceMenuOpen, setIsResourceMenuOpen] = useState(false);
  const [isMpcMenuOpen, setIsMpcMenuOpen] = useState(false);
  
  // Add state for selected prompts
  const [selectedPrompts, setSelectedPrompts] = useState<Prompt[]>([]);
  const [selectedResources, setSelectedResources] = useState<Resource[]>([]);
  
  // Initialize MPC server connection with the appropriate servers
  const { 
    status: serverStatus,
    tools: mcpTools,
    prompts: availablePrompts,
    resources: availableResources,
    executeTool,
    toolToServerMap
  } = useMCPServer({
    mcpServers: setActiveServers ? activeServers : localActiveServers
  });

  // Add a state to track if WebContainer is ready
  const [webContainerReady, setWebContainerReady] = useState(false);

  // Add a reference to the WebContainer context
  const webContainer = useContext(WebContainerContext);

  // Add a state to track if initialization was attempted already
  const [serverInitAttempted, setServerInitAttempted] = useState(false);

  // Use the setter from props if available, otherwise use the local state
  const updateActiveServers = useCallback((servers: Record<string, ServerConfig>) => {
    if (setActiveServers) {
      setActiveServers(servers);
    } else {
      setLocalActiveServers(servers);
    }
  }, [setActiveServers]);

  // Ensure we track changes to activeServers from props
  useEffect(() => {
    if (Object.keys(activeServers).length > 0) {
      setLocalActiveServers(activeServers);
    }
  }, [activeServers]);

  // Add a function to properly initialize MPC servers with retries and checks
  const initializeMPCServer = async (serverName: string) => {
    if (!webContainer) {
      console.error("Cannot activate MPC server: WebContainer is not available");
      alert("WebContainer is not available. Please refresh the page and try again.");
      return;
    }

    try {
      console.log(`Attempting to initialize MPC server: ${serverName}`);
      setServerInitAttempted(true);
      
      // Check if the server is already active
      if (activeServers[serverName]) {
        console.log(`MPC Server "${serverName}" is already active.`);
        return;
      }
      
      // Add the selected server to existing active servers
      const updatedServers = {
        ...activeServers,
        [serverName]: availableServerConfigs[serverName]
      };
      
      // Wait a moment to ensure WebContainer is ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set the active servers
      updateActiveServers(updatedServers);
      
      // Log success attempt
      console.log(`MPC Server "${serverName}" activation initiated. Check console for status updates.`);
      
    } catch (error) {
      console.error("Error initializing MPC server:", error);
      alert(`Failed to initialize ${serverName} server. See console for details.`);
    }
  };

  // Add a function to remove a specific MPC server
  const removeMPCServer = (serverName: string) => {
    if (!activeServers[serverName]) {
      console.log(`MPC Server "${serverName}" is not active.`);
      return;
    }
    
    console.log(`Removing MPC server: ${serverName}`);
    
    // Create a copy of active servers without the one to be removed
    const updatedServers = { ...activeServers };
    delete updatedServers[serverName];
    
    // Update active servers
    updateActiveServers(updatedServers);
  };

  // Add a function to create and add a custom MPC server
  const addCustomMPCServer = (name: string, command: string, args: string) => {
    if (!webContainer) {
      console.error("Cannot create custom MPC server: WebContainer is not available");
      alert("WebContainer is not available. Please refresh the page and try again.");
      return;
    }

    console.log(`Creating custom MPC server: ${name}`);
    
    try {
      // Create a custom server config
      const customConfig: ServerConfig = {
        command: command,
        args: args.split(' '),
        env: {}
      };
      
      // Add to available configurations
      const updatedConfigs = { 
        ...availableServerConfigs,
        [name]: customConfig 
      };
      
      // Update available configs
      setAvailableServerConfigs(updatedConfigs);
      console.log('Updated server configs:', updatedConfigs);
      
      // Add to active servers
      const updatedServers = {
        ...activeServers,
        [name]: customConfig
      };
      
      // Update active servers (this will also activate the new server)
      updateActiveServers(updatedServers);
      
    } catch (error) {
      console.error("Error creating custom MPC server:", error);
      alert(`Failed to create custom server: ${error}`);
    }
  };

  // Add useEffect to track WebContainer readiness
  useEffect(() => {
    if (webContainer) {
      setWebContainerReady(true);
      console.log("WebContainer is available for MPC servers");
    } else {
      console.warn("WebContainer is not available yet, MPC servers cannot start");
    }
  }, [webContainer]);

  // Helper function to resize and convert image to base64
  const processImage = (file: File): Promise<{data: string, mediaType: string}> => {
    return new Promise((resolve, reject) => {
      // Create a FileReader to read the file
      const reader = new FileReader();
      
      // Set up FileReader onload event
      reader.onload = (event) => {
        if (!event.target?.result) {
          reject(new Error("Failed to read file"));
          return;
        }
        
        // Create an image element to get dimensions
        const img = new Image();
        img.onload = () => {
          // Target size - aiming for ~200x200 (0.04 megapixels)
          // This keeps costs very low according to the table
          const targetPixels = 200 * 200;
          const imgPixels = img.width * img.height;
          
          let width = img.width;
          let height = img.height;
          
          // If image is larger than target, calculate new dimensions
          if (imgPixels > targetPixels) {
            const ratio = Math.sqrt(targetPixels / imgPixels);
            width = Math.floor(img.width * ratio);
            height = Math.floor(img.height * ratio);
          }
          
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          // Draw resized image to canvas
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Get base64 data without prefix
          const base64Data = canvas.toDataURL(file.type).split(',')[1];
          
          resolve({
            data: base64Data,
            mediaType: file.type
          });
        };
        
        img.onerror = () => {
          reject(new Error("Failed to load image"));
        };
        
        img.src = event.target.result as string;
      };
      
      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };
      
      reader.readAsDataURL(file);
    });
  };

  // Define the callLLM function that will be passed to useWebContainerAgent
  const callLLM = useCallback(
    async (
      messages: AnthropicMessage[],
      systemPrompt: string,
      tools: any[]
    ) => {
      if (!apiKey || apiKey === "") {
        console.log("Anthropic API key is required");
        onRequestApiKey?.();
        throw new Error("Anthropic API key is required. Please enter your API key to continue.");
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 4000,
          messages: messages,
          system: systemPrompt,
          tools: tools,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || "Failed to get response from Anthropic"
        );
      }

      return await response.json();
    },
    [apiKey, onRequestApiKey]
  );

  // Function to transform MPC tools to match Anthropic's API format
  const transformMpcTools = (tools: any[]) => {
    // Store MCP tool names in a separate array for identification
    const mcpToolNames = tools.map(tool => tool.name);
    console.log("MCP tool names:", mcpToolNames);
    
    return tools.map(tool => {
      // Create a copy with a more flexible type to allow property manipulation
      const transformedTool: Record<string, any> = { ...tool };
      
      // Convert inputSchema to input_schema if it exists
      if ('inputSchema' in transformedTool && !('input_schema' in transformedTool)) {
        transformedTool.input_schema = transformedTool.inputSchema;
        delete transformedTool.inputSchema;
      }
      
      // Check for additional MPC-specific properties that need conversion
      if (transformedTool.custom && typeof transformedTool.custom === 'object') {
        const customObj = transformedTool.custom as Record<string, any>;
        if ('inputSchema' in customObj && !('input_schema' in customObj)) {
          customObj.input_schema = customObj.inputSchema;
          delete customObj.inputSchema;
        }
      }
      
      return transformedTool;
    });
  };

  // Store MCP tool names for later lookup
  const [mcpToolNames, setMcpToolNames] = useState<string[]>([]);

  // Add a helper function to execute MCP tools correctly
  const executeMcpTool = async (toolName: string, args: any): Promise<ToolResult> => {
    if (!executeTool) {
      console.error("executeTool function not available");
      return {
        status: "error" as const,
        error: "Tool execution function not available"
      };
    }
    
    try {
      console.log(`Executing MCP tool: ${toolName} with args:`, args);
      
      // Check if this is actually an MCP tool
      if (!mcpToolNames.includes(toolName)) {
        console.error(`${toolName} is not a recognized MCP tool`);
        return {
          status: "error" as const,
          error: `${toolName} is not a recognized MCP tool. Available MCP tools: ${mcpToolNames.join(', ')}`
        };
      }
      
      // Get the server that this tool belongs to from the toolToServerMap
      const serverName = toolToServerMap ? toolToServerMap.get(toolName) : undefined;
      if (!serverName) {
        console.error(`No server found for tool: ${toolName}`);
        return { 
          status: "error" as const, 
          error: `No server found for tool: ${toolName}. Available servers: ${Object.keys(activeServers).join(', ')}` 
        };
      }
      
      console.log(`Tool ${toolName} is mapped to server: ${serverName}`);
      
      // Execute the tool with the correct server context
      const result = await executeTool(toolName, args);
      console.log(`Tool ${toolName} execution result:`, result);
      
      return {
        status: "success" as const,
        message: `Successfully executed ${toolName}`,
        content: result
      };
    } catch (error) {
      console.error(`Error executing MCP tool ${toolName}:`, error);
      return {
        status: "error" as const,
        error: `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };

  // Get the agent hook with our custom callLLM function
  const {
    messages: agentMessages,
    sendMessage,
    clearMessages: clearAgentMessages,
    isLoading,
    updateTestResults,
    updateTools
  } = useWebContainerAgent({
    callLLM: callLLM,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    tools: mcpTools && mcpTools.length > 0 
      ? [...DEFAULT_TOOLS, ...transformMpcTools(mcpTools)] 
      : DEFAULT_TOOLS,
    executeMcpTool,
    mcpToolNames
  });

  // Sync agent messages with the Chat component's messages
  useEffect(() => {
    if (agentMessages.length > 0) {
      // Check if messages have actually changed
      const agentMessagesIds = agentMessages.map(m => m.id).join(',');
      const currentMessagesIds = messages.map(m => m.id).join(',');
      
      if (agentMessagesIds !== currentMessagesIds) {
        setMessages(agentMessages);
      }
    }
  }, [agentMessages, setMessages, messages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      
      // Initialize height on mount
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.style.height = '0';
          const newHeight = Math.min(inputRef.current.scrollHeight, 480);
          inputRef.current.style.height = `${newHeight}px`;
        }
      }, 0);
    }
  }, []);

  // Update test results when they change from props
  useEffect(() => {
    if (testResults && updateTestResults) {
      updateTestResults(testResults);
    }
  }, [testResults, updateTestResults]);

  // Update handleSendMessage to include selected prompts instead of tools
  const handleSendMessage = async () => {
    if (!input.trim() && selectedFiles.length === 0 && selectedPrompts.length === 0 && selectedResources.length === 0) return;
    if (!apiKey || apiKey === "") {
      console.log("Anthropic API key is required");
      onRequestApiKey?.();
      return;
    }

    const currentInput = input;
    setInput("");
    
    try {
      // Create user content as an array
      const userContent: ContentBlock[] = [];
      
      // Add images first if any
      if (selectedFiles.length > 0) {
        const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
          const processedImages = await Promise.all(
            imageFiles.map(file => processImage(file))
          );
          
          for (const img of processedImages) {
            userContent.push({
              type: "image",
              source: {
                type: "base64",
                media_type: img.mediaType,
                data: img.data
              }
            });
          }
        }
      }
      
      // Build message text with selected prompts and resources
      let messageText = currentInput;
      
      // Add prompt templates if any
      if (selectedPrompts.length > 0) {
        // Get the content of the first prompt and add any additional ones as references
        messageText = selectedPrompts[0].content + (messageText ? ` ${messageText}` : "");
        
        // If there are more than one prompt, add them as references
        if (selectedPrompts.length > 1) {
          const additionalPrompts = selectedPrompts.slice(1).map(prompt => 
            `- Also consider: ${prompt.name}`
          ).join('\n');
          
          messageText = `${messageText}\n\n${additionalPrompts}`;
        }
      }
      
      // Add resources information if any
      if (selectedResources.length > 0) {
        // Create resource content blocks
        for (const resource of selectedResources) {
          userContent.push({
            type: "document",
            title: resource.name,
            source: {
              type: "text",
              media_type: resource.mimeType || "text/plain",
              data: resource.text || "",
              // uri: resource.uri || ""
            }
          });
        }
      }
      
      // Add text content if we have any
      if (messageText.trim()) {
        userContent.push({
          type: "text",
          text: messageText
        });
      }
      
      // Clear selections after sending
      setSelectedFiles([]);
      setSelectedPrompts([]);
      setSelectedResources([]);
      
      // Send message with content blocks if there are any, otherwise with just text
      if (userContent.length > 0) {
        await sendMessage(userContent);
      } else if (currentInput.trim()) {
        await sendMessage(currentInput);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const toggleToolCollapse = (messageId: string) => {
    setCollapsedTools((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Clear messages function
  const handleClearMessages = () => {
    clearAgentMessages();
    setMessages([
      {
        id: "1",
        type: "assistant_message",
        content: "Hello! I'm your coding assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ]);
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    handleClearMessages
  }));

  // Add groupedMessagesRef before getGroupedMessages
  const groupedMessagesRef = useRef<{
    key: string;
    result: Array<Message | { type: 'tool_pair', call: ToolCallMessage, result: ToolResultMessage }>;
  } | null>(null);

  // Group messages to pair tool calls with their results
  const getGroupedMessages = useCallback(() => {
    const messagesKey = messages.map(m => m.id).join(',');
    // Use ref to cache the last result
    if (groupedMessagesRef.current && groupedMessagesRef.current.key === messagesKey) {
      return groupedMessagesRef.current.result;
    }
    
    const groupedMessages: Array<Message | { type: 'tool_pair', call: ToolCallMessage, result: ToolResultMessage }> = [];
    const toolResultsById: Record<string, ToolResultMessage> = {};
    
    // First, identify all tool results and index them by their toolCallId
    messages.forEach(msg => {
      if (msg.type === 'tool_result') {
        toolResultsById[msg.toolCallId] = msg;
      }
    });
    
    // Now, process all messages and pair tool calls with their results
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (message.type === 'tool_call') {
        const result = toolResultsById[message.toolCall.id];
        
        if (result) {
          // Skip adding the result separately since we're pairing it
          groupedMessages.push({ 
            type: 'tool_pair', 
            call: message,
            result: result
          });
        } else {
          // No result found, just add the tool call
          groupedMessages.push(message);
        }
      } else if (message.type === 'tool_result') {
        // Only add result if it wasn't already paired with a call
        const alreadyPaired = groupedMessages.some(
          m => m.type === 'tool_pair' && 'result' in m && m.result.id === message.id
        );
        
        if (!alreadyPaired) {
          groupedMessages.push(message);
        }
      } else {
        // Regular message, add as is
        groupedMessages.push(message);
      }
    }
    
    // Cache the result
    groupedMessagesRef.current = {
      key: messagesKey,
      result: groupedMessages
    };
    
    return groupedMessages;
  }, [messages]);

  // Render tool call and result as a single card
  const renderToolCard = (toolCall: ToolCall, toolResult?: ToolResult) => {
    const isCollapsed = collapsedTools[toolCall.id] || false;
    const { name, arguments: args } = toolCall;

    // Format tool name for display
    const formatToolName = (name: string) => {
      return name
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };

    // Get file path for display
    const getFilePath = () => {
      if (
        name === "edit_file" ||
        name === "create_file" ||
        name === "delete_file" ||
        name === "read_file"
      ) {
        return name === "read_file" ? args.target_file : args.file_path;
      }
      return null;
    };

    // Get content for code block
    const getCodeContent = () => {
      if (name === "edit_file" || name === "create_file") {
        return args.content || "";
      }
      return JSON.stringify(args, null, 2);
    };

    // Get old content for diff view
    const getOldContent = () => {
      if (name === "edit_file" && toolResult?.oldContent) {
        return toolResult.oldContent;
      }
      return null;
    };

    const filePath = getFilePath();
    const codeContent = getCodeContent();
    const oldContent = getOldContent();

    return (
      <div className="mt-2 overflow-hidden bg-[#252526] rounded">
        <div className="py-2 px-3 border-b border-[#3c3c3c]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-400" />
              <div className="text-sm font-medium">
                {formatToolName(name)}{" "}
                {filePath && (
                  <span className="text-gray-400 ml-1">
                    ({filePath})
                  </span>
                )}
              </div>
            </div>
            <button
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-[#3c3c3c] focus:outline-none"
              onClick={() => toggleToolCollapse(toolCall.id)}
            >
              {isCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="p-0">
            {name === "edit_file" || name === "create_file" ? (
              <div className="overflow-x-auto bg-[#1e1e1e] p-3">
                {name === "edit_file" && oldContent && (
                  <div className="mt-2 border-t border-[#3c3c3c] pt-2">
                    <div className="text-xs font-medium mb-1">Changes:</div>
                    <div className="text-xs font-mono">
                      {codeContent
                        .split("\n")
                        .map((line: string, i: number) => {
                          const oldLines = oldContent.split("\n");
                          const oldLine = oldLines[i] || "";
                          if (line === oldLine) {
                            return (
                              <div key={i} className="text-gray-400">
                                {line}
                              </div>
                            );
                          } else if (!oldLine) {
                            return (
                              <div
                                key={i}
                                className="bg-green-900/30 text-green-400"
                              >
                                + {line}
                              </div>
                            );
                          } else if (!line) {
                            return (
                              <div
                                key={i}
                                className="bg-red-900/30 text-red-400"
                              >
                                - {oldLine}
                              </div>
                            );
                          } else {
                            return (
                              <div key={i}>
                                <div className="bg-red-900/30 text-red-400">
                                  - {oldLine}
                                </div>
                                <div className="bg-green-900/30 text-green-400">
                                  + {line}
                                </div>
                              </div>
                            );
                          }
                        })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-[#1e1e1e]">
                <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            )}

            {toolResult && (
              <div className="p-3 border-t border-[#3c3c3c] bg-[#1e1e1e]">
                <div className="text-xs font-medium mb-1">Result:</div>
                <div className="text-sm">
                  {toolResult.status === "success" ? (
                    <span className="text-green-400">
                      {toolResult.message}
                    </span>
                  ) : (
                    <span className="text-red-400">
                      {toolResult.error || "An error occurred"}
                    </span>
                  )}
                </div>
                {renderToolResultContent(toolResult)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render message content based on message type
  const renderMessageContent = (message: Message | { type: 'tool_pair', call: ToolCallMessage, result: ToolResultMessage }) => {
    if (message.type === 'user_message' || message.type === 'assistant_message') {
      // Handle different content types
      if (typeof message.content === 'string') {
        // Simple string content
        return (
          <div className="text-sm whitespace-pre-wrap break-words overflow-hidden">
            {message.content}
          </div>
        );
      } else if (Array.isArray(message.content)) {
        // Array of content blocks (e.g. for images)
        return (
          <div className="text-sm whitespace-pre-wrap break-words overflow-hidden">
            {message.content.map((block, index) => {
              if (block.type === 'text') {
                return <div key={index}>{block.text}</div>;
              } else if (block.type === 'image') {
                // Show a small image preview
                return (
                  <div key={index} className="my-2">
                    <div className="inline-block max-w-[200px] max-h-[200px] rounded-md overflow-hidden border border-[#3c3c3c]">
                      <img 
                        src={`data:${block.source.media_type};base64,${block.source.data}`}
                        alt="Attached image"
                        className="max-w-full max-h-[200px] object-contain"
                      />
                    </div>
                  </div>
                );
              } else if (block.type === 'document') {
                // Show resource reference
                return (
                  <div key={index} className="my-2 p-2 bg-[#252526] rounded-md border border-[#3c3c3c]">
                    <div className="flex items-center gap-2 mb-1">
                      {block.source.media_type?.includes('folder') ? (
                        <FolderIcon className="h-3 w-3 text-yellow-400" />
                      ) : (
                        <FileIcon className="h-3 w-3 text-yellow-400" />
                      )}
                      <span className="text-xs font-medium text-yellow-400">{block.title || 'Resource'}</span>
                    </div>
                    <div className="text-xs text-gray-400 truncate">{block.source.uri}</div>
                    {block.source.data && <div className="text-xs mt-1">{block.source.data}</div>}
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      }
      // Fallback
      return <div className="text-sm">Message content unavailable</div>;
    } else if (message.type === 'tool_pair') {
      return renderToolCard(message.call.toolCall, message.result.result);
    } else if (message.type === 'tool_call') {
      return renderToolCard(message.toolCall);
    } else if (message.type === 'tool_result') {
      // This should usually not be rendered separately, but as a fallback
      return (
        <div className="p-3 bg-[#1e1e1e] rounded mt-2">
          <div className="text-xs font-medium mb-1">Tool Result:</div>
          <div className="text-sm">
            {message.result.status === "success" ? (
              <span className="text-green-400">
                {message.result.message || JSON.stringify(message.result)}
              </span>
            ) : (
              <span className="text-red-400">
                {message.result.error || "An error occurred"}
              </span>
            )}
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Determine if a message is from the user
  const isUserMessage = (message: Message | { type: 'tool_pair', call: ToolCallMessage, result: ToolResultMessage }) => {
    return message.type === 'user_message';
  };

  // Determine if a message is from the assistant
  const isAssistantMessage = (message: Message | { type: 'tool_pair', call: ToolCallMessage, result: ToolResultMessage }) => {
    return message.type === 'assistant_message' || message.type === 'tool_call' || 
      message.type === 'tool_result' || message.type === 'tool_pair';
  };

  const groupedMessages = getGroupedMessages();

  // Handle file selection
  const handleFileSelect = (fileList: FileList) => {
    const files = Array.from(fileList);
    setSelectedFiles(files);
    // Here you would handle the actual file upload/attachment logic
    console.log("Selected files:", files);
  };

  // Handle opening MPC menu
  const handleMpcMenuOpen = () => {
    if (webContainer) {
      setIsMpcMenuOpen(true);
    } else {
      alert("WebContainer is not initialized. Please wait a moment and try again.");
      console.log("WebContainer status:", webContainer ? "Available" : "Not Available");
    }
  };

  // Handle opening server config
  const handleServerConfigOpen = () => {
    if (webContainer) {
      setIsServerConfigOpen(true);
    } else {
      alert("WebContainer is not initialized. Please wait a moment and try again.");
      console.log("WebContainer status:", webContainer ? "Available" : "Not Available");
    }
  };

  // Handle saving server config
  const handleSaveServerConfig = (selectedServers: Record<string, ServerConfig>) => {
    console.log("Activating MPC servers:", selectedServers);
    
    // If no WebContainer, warn and don't proceed
    if (!webContainerReady) {
      console.error("Cannot activate MPC servers: WebContainer is not ready");
      return;
    }
    
    // Delay setting servers to give WebContainer time to process
    setTimeout(() => {
      updateActiveServers(selectedServers);
    }, 500);
  };

  // Add handler for prompt selection
  const handleSelectPrompt = (prompt: Prompt) => {
    // Only keep one prompt (replace any existing)
    setSelectedPrompts([prompt]);
  };

  const handleSelectResource = (resource: Resource) => {
    setSelectedResources(prev => [...prev, resource]);
  };

  // Add server status message component 
  const renderServerStatus = () => {
    if (!activeServers || Object.keys(activeServers).length === 0) {
      return null;
    }

    if (serverStatus === 'READY') {
      return (
        <div className="px-4 py-2 bg-green-900/20 border-b border-green-600/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-green-400">
              MPC Server connected: {Object.keys(activeServers).join(', ')}
            </span>
          </div>
          <button 
            className="text-xs text-green-400 hover:text-green-300"
            onClick={handleServerConfigOpen}
          >
            Configure
          </button>
        </div>
      );
    } else if (serverStatus === 'STARTING' || serverStatus === 'INSTALLING_NODE_MODULES') {
      return (
        <div className="px-4 py-2 bg-yellow-900/20 border-b border-yellow-600/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
            <span className="text-xs text-yellow-400">
              Starting MPC Server: {Object.keys(activeServers).join(', ')}
            </span>
          </div>
          <button 
            className="text-xs text-yellow-400 hover:text-yellow-300"
            onClick={handleServerConfigOpen}
          >
            Configure
          </button>
        </div>
      );
    } else if (serverStatus === 'ERROR') {
      return (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-600/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-xs text-red-400">
              Error connecting to MPC Server. Check console for details.
            </span>
          </div>
          <button 
            className="text-xs text-red-400 hover:text-red-300"
            onClick={handleServerConfigOpen}
          >
            Configure
          </button>
        </div>
      );
    }

    return null;
  };

  // Re-add the slash button and at sign button handlers
  const handleSlashButtonClick = () => {
    if (webContainer) {
      setIsPromptMenuOpen(true);
    } else {
      alert("WebContainer is not initialized. Please wait a moment and try again.");
    }
  };

  const handleAtSignButtonClick = () => {
    if (webContainer) {
      setIsResourceMenuOpen(true);
    } else {
      alert("WebContainer is not initialized. Please wait a moment and try again.");
    }
  };

  // Safely render tool result content
  const renderToolResultContent = (result: ToolResult) => {
    if (!result) return null;
    
    if (result.content) {
      // Handle complex content objects that might be returned by MPC tools
      if (typeof result.content === 'object' && Array.isArray(result.content)) {
        // Create a local typed variable to help TypeScript understand the type
        const contentItems: any[] = result.content;
        
        return (
          <div className="mt-2 pt-2 border-t border-[#3c3c3c]">
            <div className="text-xs font-medium mb-1">Content:</div>
            {contentItems.map((item: any, index: number) => {
              if (typeof item === 'object' && item !== null) {
                // Check both conditions separately for clarity and consistency
                if (item.type === 'text' && 'text' in item) {
                  return (
                    <pre key={index} className="text-xs font-mono overflow-auto p-2 bg-[#252526] rounded max-h-64">
                      {String(item.text)}
                    </pre>
                  );
                }
                // For other object types, stringify them
                return (
                  <pre key={index} className="text-xs font-mono overflow-auto p-2 bg-[#252526] rounded max-h-64">
                    {JSON.stringify(item, null, 2)}
                  </pre>
                );
              }
              // For simple string content
              return (
                <pre key={index} className="text-xs font-mono overflow-auto p-2 bg-[#252526] rounded max-h-64">
                  {String(item)}
                </pre>
              );
            })}
          </div>
        );
      }
      
      // For string content
      if (typeof result.content === 'string') {
        return (
          <div className="mt-2 pt-2 border-t border-[#3c3c3c]">
            <div className="text-xs font-medium mb-1">Content:</div>
            <pre className="text-xs font-mono overflow-auto p-2 bg-[#252526] rounded max-h-64">
              {result.content}
            </pre>
          </div>
        );
      }
      
      // For other object types (non-array objects)
      return (
        <div className="mt-2 pt-2 border-t border-[#3c3c3c]">
          <div className="text-xs font-medium mb-1">Content:</div>
          <pre className="text-xs font-mono overflow-auto p-2 bg-[#252526] rounded max-h-64">
            {JSON.stringify(result.content, null, 2)}
          </pre>
        </div>
      );
    }
    
    return null;
  };

  // Update tools when mcpTools changes
  useEffect(() => {
    if (updateTools && mcpTools) {
      // Compare to see if tools have actually changed to avoid unnecessary updates
      const toolNames = mcpTools.map(t => t.name);
      const toolNamesString = toolNames.join(',');
      
      // Only update if the tool names have changed
      if (toolNamesString !== mcpToolNames.join(',')) {
        setMcpToolNames(toolNames);
        
        // Log the tools to help debug
        console.log("Available MCP tools:", toolNames);
        
        // Transform MPC tools to match Anthropic's API format
        const transformedMpcTools = transformMpcTools(mcpTools);
        
        const combinedTools = transformedMpcTools.length > 0 ? [...DEFAULT_TOOLS, ...transformedMpcTools] : DEFAULT_TOOLS;
        updateTools(combinedTools);
        console.log("Updated tools with MCP tools:", transformedMpcTools.length);
      }
    }
  }, [mcpTools, updateTools, mcpToolNames]);

  // Memoize the message content renderer for better performance
  const MemoizedMessageContent = React.memo(
    ({ message }: { message: Message | { type: 'tool_pair', call: ToolCallMessage, result: ToolResultMessage } }) => {
      return renderMessageContent(message);
    }
  );

  return (
    <div className="h-full flex flex-col w-full bg-[#1e1e1e]">
      {/* Server config sheet - only show it if we're managing servers locally */}
      {!setActiveServers && (
        <ServerConfigSheet
          availableServers={availableServerConfigs}
          activeServers={setActiveServers ? activeServers : localActiveServers}
          isOpen={isServerConfigOpen}
          onOpenChange={setIsServerConfigOpen}
          onSave={handleSaveServerConfig}
          serverStatus={serverStatus}
          tools={mcpTools}
          serverToolMapping={toolToServerMap ? Object.fromEntries(toolToServerMap) : {}}
          webContainerReady={webContainerReady}
        />
      )}
      
      {/* Only show MPC Server Menu if not managed by parent */}
      {!setActiveServers && (
        <MpcServerMenu
          serverConfigs={availableServerConfigs}
          activeServers={setActiveServers ? activeServers : localActiveServers}
          serverStatus={serverStatus}
          webContainerReady={webContainerReady}
          onSelectServer={initializeMPCServer}
          onRemoveServer={removeMPCServer}
          onAddCustomServer={addCustomMPCServer}
          isOpen={isMpcMenuOpen}
          onOpenChange={setIsMpcMenuOpen}
        />
      )}

      {/* Pass prompts to PromptMenu */}
      <PromptMenu
        isOpen={isPromptMenuOpen}
        onOpenChange={setIsPromptMenuOpen}
        prompts={availablePrompts}
        onSelectPrompt={handleSelectPrompt}
      />

      {/* Pass resources to ResourceMenu */}
      <ResourceMenu
        isOpen={isResourceMenuOpen}
        onOpenChange={setIsResourceMenuOpen}
        resources={availableResources}
        onSelectResource={handleSelectResource}
      />
      
      {/* Only show server status if we're managing servers locally */}
      {!setActiveServers && renderServerStatus()}
    
      <div className="flex-1 p-4 overflow-y-auto" ref={scrollAreaRef}>
        <div className="flex flex-col gap-4 max-w-full">
          {groupedMessages.map((message, index) => (
            <div
              key={message.type === 'tool_pair' ? `pair-${message.call.id}-${message.result.id}` : ('id' in message ? message.id : index)}
              className={`flex gap-3 ${
                isUserMessage(message) ? "justify-end" : "justify-start"
              }`}
            >
              {isAssistantMessage(message) && (
                <div className="h-8 w-8 rounded-full bg-[#2563eb] flex items-center justify-center flex-shrink-0">
                  <BotIcon className="h-4 w-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  isUserMessage(message)
                    ? "bg-[#2563eb] text-white"
                    : "bg-[#252526] text-gray-100"
                }`}
              >
                <MemoizedMessageContent message={message} />

                <div className="text-xs mt-1 opacity-70 text-right">
                  {formatTime(message.type === 'tool_pair' ? message.call.timestamp : 'timestamp' in message ? message.timestamp : new Date())}
                </div>
              </div>

              {isUserMessage(message) && (
                <div className="h-8 w-8 rounded-full bg-[#3c3c3c] flex items-center justify-center flex-shrink-0">
                  <UserIcon className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-[#2563eb] flex items-center justify-center flex-shrink-0">
                <BotIcon className="h-4 w-4 text-white" />
              </div>
              <div className="p-3 bg-[#252526] rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div
                    className="h-2 w-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="h-2 w-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t border-[#3c3c3c] bg-[#1e1e1e]">
        {/* Display selected files, prompts, and resources */}
        {(selectedFiles.length > 0 || selectedPrompts.length > 0 || selectedResources.length > 0) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {/* Image files */}
            {selectedFiles.map((file, index) => (
              <div key={`file-${index}`} className="relative group">
                <div className="w-16 h-16 rounded-md overflow-hidden border border-[#4c4c4c] bg-[#2a2a2a] flex items-center justify-center">
                  {file.type.startsWith('image/') ? (
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name} 
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <button 
                  onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                  className="absolute -top-1 -right-1 bg-[#2a2a2a] border border-[#4c4c4c] rounded-full w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 px-1 text-[10px] text-white truncate">
                  {file.name}
                </div>
              </div>
            ))}
            
            {/* Selected prompts */}
            {selectedPrompts.map((prompt, index) => (
              <div key={`prompt-${index}`} className="relative group">
                <div className="w-32 rounded-md overflow-hidden border border-[#4c4c4c] bg-[#2a2a2a] p-2">
                  <div className="text-xs font-medium text-blue-400 flex items-center gap-1 mb-1">
                    <Sparkles className="h-3 w-3" />
                    <span>Prompt</span>
                  </div>
                  <div className="text-[11px] text-white truncate">{prompt.name}</div>
                </div>
                <button 
                  onClick={() => setSelectedPrompts(selectedPrompts.filter((_, i) => i !== index))}
                  className="absolute -top-1 -right-1 bg-[#2a2a2a] border border-[#4c4c4c] rounded-full w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            
            {/* Selected resources */}
            {selectedResources.map((resource, index) => (
              <div key={`resource-${index}`} className="relative group">
                <div className="w-32 rounded-md overflow-hidden border border-[#4c4c4c] bg-[#2a2a2a] p-2">
                  <div className="text-xs font-medium text-yellow-400 flex items-center gap-1 mb-1">
                    {resource.mimeType?.includes('folder') ? (
                      <FolderIcon className="h-3 w-3" />
                    ) : (
                      <FileIcon className="h-3 w-3" />
                    )}
                    <span>Resource</span>
                  </div>
                  <div className="text-[11px] text-white truncate">{resource.name}</div>
                </div>
                <button 
                  onClick={() => setSelectedResources(selectedResources.filter((_, i) => i !== index))}
                  className="absolute -top-1 -right-1 bg-[#2a2a2a] border border-[#4c4c4c] rounded-full w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative"
        >
          <div className="flex flex-col gap-2 px-3 py-2 rounded-xl bg-[#323232] border border-[#3c3c3c] focus-within:ring-1 focus-within:ring-[#3c3c3c]">
            <div className="flex gap-1">
              {/* File trigger button */}
              <FileTrigger
                onSelect={(e) => handleFileSelect(e as FileList)}
                acceptedFileTypes={["image/*"]}
              >
                <AriaButton 
                  type="button"
                  className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-[#404040] focus:outline-none transition-colors"
                  isDisabled={isLoading}
                >
                  <ImageIcon className="h-5 w-5" />
                </AriaButton>
              </FileTrigger>
              
              {/* Only show MPC Servers button if we're managing servers locally */}
              {!setActiveServers && (
                <button 
                  type="button"
                  className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-[#404040] focus:outline-none transition-colors"
                  disabled={isLoading}
                  onClick={handleMpcMenuOpen}
                >
                  <Server className="h-5 w-5" />
                </button>
              )}
              
              {/* Slash command button */}
              <button 
                type="button"
                className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-[#404040] focus:outline-none transition-colors"
                disabled={isLoading}
                onClick={handleSlashButtonClick}
              >
                <SlashIcon className="h-5 w-5" />
              </button>
              
              {/* At sign button for resources */}
              <button 
                type="button"
                className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-[#404040] focus:outline-none transition-colors"
                disabled={isLoading}
                onClick={handleAtSignButtonClick}
              >
                <AtSignIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="relative">
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-adjust height
                  e.target.style.height = '0';
                  const newHeight = Math.min(e.target.scrollHeight, 480);
                  e.target.style.height = `${newHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() || selectedFiles.length > 0) {
                      handleSendMessage();
                    }
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 w-full bg-transparent text-white border-0 text-sm focus:ring-0 focus:outline-none py-2 resize-none"
                disabled={isLoading}
                rows={1}
                style={{ minHeight: '40px', height: 'auto' }}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || !input.trim() && selectedFiles.length === 0}
              className="p-2 rounded-full bg-[#2563eb] w-9.5 h-9 ml-auto text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-[#2563eb] hover:bg-[#2060e0] transition-colors ml-2"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          
         
        </form>
      </div>
    </div>
  );
}), (prevProps, nextProps) => {
  // Custom comparison function
  // Only re-render if these specific props have changed
  return (
    prevProps.apiKey === nextProps.apiKey &&
    JSON.stringify(prevProps.testResults) === JSON.stringify(nextProps.testResults) &&
    // Deep compare messages only if the length has changed
    (prevProps.messages.length === nextProps.messages.length || 
      JSON.stringify(prevProps.messages.map(m => m.id)) === JSON.stringify(nextProps.messages.map(m => m.id)))
  );
});