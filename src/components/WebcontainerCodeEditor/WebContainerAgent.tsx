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
  AlertCircle
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
import { MpcServerMenu } from "@/components/MpcServerMenu";

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
  apiKey: string;
  onRequestApiKey?: () => void;
  testResults?: any;
  serverConfigs?: Record<string, ServerConfig>;
}

// Define the handle type for the ref
export interface WebContainerAgentHandle {
  handleClearMessages: () => void;
}

export const WebContainerAgent = forwardRef<WebContainerAgentHandle, WebContainerAgentProps>(({ 
  messages, 
  setMessages, 
  apiKey, 
  onRequestApiKey,
  testResults,
  serverConfigs = DEFAULT_SERVER_CONFIGS
}, ref) => {
  const [input, setInput] = useState("");
  const [collapsedTools, setCollapsedTools] = useState<Record<string, boolean>>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isServerConfigOpen, setIsServerConfigOpen] = useState(false);
  const [activeServers, setActiveServers] = useState<Record<string, ServerConfig>>({});
  const [availableServerConfigs, setAvailableServerConfigs] = useState<Record<string, ServerConfig>>(serverConfigs);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize MPC server connection
  const { 
    status: serverStatus,
    tools: mcpTools,
    executeTool,
    toolToServerMap
  } = useMCPServer({
    mcpServers: activeServers
  });

  // Add a state to track if WebContainer is ready
  const [webContainerReady, setWebContainerReady] = useState(false);

  // Add a reference to the WebContainer context
  const webContainer = useContext(WebContainerContext);

  // Add a state to track if initialization was attempted already
  const [serverInitAttempted, setServerInitAttempted] = useState(false);

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
      setActiveServers(updatedServers);
      
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
    setActiveServers(updatedServers);
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
      setActiveServers(updatedServers);
      
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

  // Get the agent hook with our custom callLLM function
  const {
    messages: agentMessages,
    sendMessage,
    clearMessages: clearAgentMessages,
    isLoading,
    updateTestResults,
  } = useWebContainerAgent({
    callLLM: callLLM,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    tools: DEFAULT_TOOLS,
  });

  // Sync agent messages with the Chat component's messages
  useEffect(() => {
    if (agentMessages.length > 0) {
      setMessages(agentMessages);
    }
  }, [agentMessages, setMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Update test results when they change from props
  useEffect(() => {
    if (testResults && updateTestResults) {
      updateTestResults(testResults);
    }
  }, [testResults, updateTestResults]);

  const handleSendMessage = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;
    if (!apiKey || apiKey === "") {
      console.log("Anthropic API key is required");
      onRequestApiKey?.();
      return;
    }

    const currentInput = input;
    setInput("");
    
    try {
      // Process all images before sending
      if (selectedFiles.length > 0) {
        // Only process image files
        const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
          // Convert all images to base64 concurrently
          const processedImages = await Promise.all(
            imageFiles.map(file => processImage(file))
          );
          
          // Format the content as multipart content following Anthropic's format
          const userContent: ContentBlock[] = [];
          
          // Add all images first
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
          
          // Add the text content
          if (currentInput.trim()) {
            userContent.push({
              type: "text",
              text: currentInput
            });
          }
          
          // Clear selected files after sending
          setSelectedFiles([]);
          
          // Send message with custom content format
          await sendMessage(userContent);
        } else {
          // No image files, send as normal text
          await sendMessage(currentInput);
        }
      } else {
        // No files, just send the text
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

  // Group messages to pair tool calls with their results
  const getGroupedMessages = useCallback(() => {
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
                {toolResult.content && (
                  <div className="mt-2 pt-2 border-t border-[#3c3c3c]">
                    <div className="text-xs font-medium mb-1">Content:</div>
                    <pre className="text-xs font-mono overflow-auto p-2 bg-[#252526] rounded max-h-64">
                      {toolResult.content}
                    </pre>
                  </div>
                )}
                {toolResult.output && (
                  <div className="mt-2 pt-2 border-t border-[#3c3c3c]">
                    <div className="text-xs font-medium mb-1">Output:</div>
                    <pre className="text-xs font-mono overflow-auto p-2 bg-[#252526] rounded max-h-64">
                      {toolResult.output}
                    </pre>
                  </div>
                )}
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

  // Handle opening the server config sheet
  const handleOpenServerConfig = () => {
    setIsServerConfigOpen(true);
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
      setActiveServers(selectedServers);
    }, 500);
  };

  // Add useEffect hook to log server status changes
  useEffect(() => {
    if (serverStatus) {
      console.log("MPC Server status changed:", serverStatus);
    }
    
    // Add more detailed debugging for error state
    if (serverStatus === 'ERROR') {
      console.error("MPC Server initialization failed. Make sure the WebContainer is fully initialized.");
      // You might want to show a notification or alert to the user here
    }
  }, [serverStatus]);

  // Add a status message component in the top of the WebContainerAgent
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
            onClick={handleOpenServerConfig}
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
            onClick={handleOpenServerConfig}
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
            onClick={handleOpenServerConfig}
          >
            Configure
          </button>
        </div>
      );
    }

    return null;
  };

  // Replace the old handleServerButtonClick with this modern implementation using CMDK
  const [isMpcMenuOpen, setIsMpcMenuOpen] = useState(false);
  
  const handleServerButtonClick = () => {
    if (webContainer) {
      setIsMpcMenuOpen(true);
    } else {
      alert("WebContainer is not initialized. Please wait a moment and try again.");
      console.log("WebContainer status:", webContainer ? "Available" : "Not Available");
    }
  };

  return (
    <div className="h-full flex flex-col w-full bg-[#1e1e1e]">
      {/* Server config sheet */}
      <ServerConfigSheet
        availableServers={availableServerConfigs}
        activeServers={activeServers}
        isOpen={isServerConfigOpen}
        onOpenChange={setIsServerConfigOpen}
        onSave={handleSaveServerConfig}
        serverStatus={serverStatus}
        tools={mcpTools}
        serverToolMapping={toolToServerMap ? Object.fromEntries(toolToServerMap) : {}}
        webContainerReady={webContainerReady}
      />
      
      {/* Add MPC Server Menu */}
      <MpcServerMenu
        serverConfigs={availableServerConfigs}
        activeServers={activeServers}
        serverStatus={serverStatus}
        webContainerReady={webContainerReady}
        onSelectServer={initializeMPCServer}
        onRemoveServer={removeMPCServer}
        onAddCustomServer={addCustomMPCServer}
        isOpen={isMpcMenuOpen}
        onOpenChange={setIsMpcMenuOpen}
      />

      {/* Server status message */}
      {renderServerStatus()}
    
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
                {renderMessageContent(message)}

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

      <div className="p-4 border-t border-[#3c3c3c] bg-[#252526]">
        {/* Display selected file previews above the input */}
        {selectedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative group">
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
          </div>
        )}
      
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          {/* File trigger button */}
          <FileTrigger
            onSelect={(e) => handleFileSelect(e as FileList)}
            acceptedFileTypes={["image/*"]}
          >
            <AriaButton 
              type="button"
              className="w-8 h-8 rounded-full bg-[#3c3c3c] flex items-center justify-center text-white hover:bg-[#4c4c4c] focus:outline-none"
              isDisabled={isLoading}
            >
              <ImageIcon className="h-4 w-4" />
            </AriaButton>
          </FileTrigger>
          
          {/* MPC Servers button */}
          <button 
            type="button"
            className="w-8 h-8 rounded-full bg-[#3c3c3c] flex items-center justify-center text-white hover:bg-[#4c4c4c] focus:outline-none"
            disabled={isLoading}
            onClick={handleServerButtonClick}
          >
            <Server className="h-4 w-4" />
          </button>
         
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-[#3c3c3c] text-white border-0 rounded p-2 text-sm focus:ring-0 focus:outline-none"
            disabled={isLoading}
          />
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center text-white disabled:bg-[#4c4c4c] disabled:cursor-not-allowed focus:outline-none"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
});