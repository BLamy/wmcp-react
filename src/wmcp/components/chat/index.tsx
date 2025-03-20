import React, { useState, useEffect, useRef } from 'react';

import { Form, DialogTrigger, Checkbox } from 'react-aria-components';
import { Button } from '@/components/aria/Button';
import { TextField } from '../../../components/aria/TextField';
import { MenuTrigger, Modal, ModalOverlay, Dialog, Heading } from 'react-aria-components';
import { WrenchIcon, Wand2, Send, Settings, MoreHorizontal, Plus, AlertCircle, Server, Save, Check, Info, X, Key } from 'lucide-react';
import { Menu, MenuItem, MenuSection } from '@/components/aria/Menu';
import { animate, AnimatePresence, motion, useMotionTemplate, useMotionValue, useMotionValueEvent, useTransform } from 'framer-motion';
import { AlertDialog } from '@/components/aria/AlertDialog';
import { Switch } from '@/components/aria/Switch';
import { 
  Disclosure, 
  DisclosureGroup, 
  DisclosureHeader, 
  DisclosurePanel 
} from '@/components/aria/Disclosure';
import { ActionCard } from '@/wmcp/components/layout/ActionCard';


import { Tool } from '@modelcontextprotocol/sdk/types';
import { ServerConfig } from '../../lib/McpClientManager';
import { MCPServerStatus, useMCPServer } from '../../hooks/useMcpServer';
import { startRegistration, startAuthentication, WebAuthnError } from '../../lib/webauthn';
import { deriveKey, encryptData, decryptData } from '../../lib/utils';
import { LoadingIndicator } from '../status/LoadingIndicator';
import { ErrorDisplay } from '../status/ErrorDisplay';

// Extend the ToolDefinition type to include serverName
interface ToolDefinition extends Tool {
  serverName?: string;
}

// Define the types for our chat messages
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCall?: {
    name: string;
    arguments: Record<string, any>;
  };
  toolResult?: any;
}

// Interface for modeling the generate response
interface GenerateResponse {
  text: string;
  toolCalls?: {
    name: string;
    arguments: Record<string, any>;
  }[];
}

// Default server configurations
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

// Wrap React Aria modal components so they support framer-motion values.
const MotionModal = motion(Modal);
const MotionModalOverlay = motion(ModalOverlay);

const inertiaTransition = {
  type: 'inertia' as const,
  bounceStiffness: 300,
  bounceDamping: 40,
  timeConstant: 300
};

const staticTransition = {
  duration: 0.5,
  ease: [0.32, 0.72, 0, 1]
};

const SHEET_MARGIN = 34;
const SHEET_RADIUS = 12;

// Server Config Sheet Component
interface ServerConfigSheetProps {
  availableServers: Record<string, ServerConfig>;
  activeServers: Record<string, ServerConfig>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (selectedServers: Record<string, ServerConfig>) => void;
  serverStatus?: MCPServerStatus | null;
  tools?: ToolDefinition[];
  serverToolMapping?: Record<string, string>;
}

function ServerConfigSheet({ 
  availableServers, 
  activeServers, 
  isOpen, 
  onOpenChange, 
  onSave,
  serverStatus = null,
  tools = [],
  serverToolMapping = {}
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

  // Get tools for a specific server using the server name
  const getToolsForServer = (serverKey: string) => {
    if (!activeServerStates[serverKey] || serverStatus !== 'READY' || !tools.length) {
      console.log(`No tools shown for server "${serverKey}" - server inactive or not ready`);
      return [];
    }
    
    // Use serverToolMapping if it's available - this comes from the MCP system
    if (serverToolMapping && Object.keys(serverToolMapping).length > 0) {
      const serverTools = tools.filter(tool => serverToolMapping[tool.name] === serverKey);
      console.log(`Server "${serverKey}" has ${serverTools.length} tools from serverToolMapping:`, 
                  serverTools.length > 0 ? serverTools.map(t => t.name).join(', ') : 'none');
      return serverTools;
    }
    
    // Fallback: if no mapping is available, use properties on the tool itself
    const serverTools = tools.filter(tool => {
      // Check various properties where server name might be stored
      const toolServer = (tool as any).server || (tool as any).serverName || (tool as any).origin;
      
      if (toolServer) {
        return toolServer === serverKey;
      }
      
      // Last resort: check if the tool name includes the server name
      return tool.name.toLowerCase().includes(serverKey.toLowerCase().replace(/-/g, '_'));
    });
    
    console.log(`Server "${serverKey}" has ${serverTools.length} tools (fallback method):`, 
                serverTools.length > 0 ? serverTools.map(t => t.name).join(', ') : 'none');
    
    return serverTools;
  };

  // Toggle server activation
  const handleToggleServerActive = (serverKey: string) => {
    const newActiveStates = {
      ...activeServerStates,
      [serverKey]: !activeServerStates[serverKey]
    };
    setActiveServerStates(newActiveStates);
    
    // Update active servers immediately
    const newActiveServers: Record<string, ServerConfig> = {};
    Object.keys(newActiveStates).forEach(key => {
      if (newActiveStates[key]) {
        newActiveServers[key] = serverConfigs[key];
      }
    });
    onSave(newActiveServers);
  };
  
  const handleEditServer = (serverKey: string) => {
    setEditingServer(serverKey);
  };
  
  const handleUpdateServerConfig = (serverKey: string, config: ServerConfig) => {
    const updatedConfigs = {
      ...serverConfigs,
      [serverKey]: config
    };
    setServerConfigs(updatedConfigs);
    
    // Update active servers if this server is active
    if (activeServerStates[serverKey]) {
      const newActiveServers = { ...activeServers };
      newActiveServers[serverKey] = config;
      onSave(newActiveServers);
    }
    
    setEditingServer(null);
  };
  
  const handleAddServer = () => {
    if (!newServerName || newServerName.trim() === '') return;
    
    const serverKey = newServerName.trim();
    const newConfig: ServerConfig = {
      command: newServerCommand,
      args: newServerArgs.split(' ').filter(arg => arg),
      env: {}
    };
    
    // Add to server configs
    const updatedConfigs = {
      ...serverConfigs,
      [serverKey]: newConfig
    };
    setServerConfigs(updatedConfigs);
    
    // Mark as active
    setActiveServerStates({
      ...activeServerStates,
      [serverKey]: true
    });
    
    // Add to active servers
    const newActiveServers = { ...activeServers };
    newActiveServers[serverKey] = newConfig;
    onSave(newActiveServers);
    
    // Reset form
    setNewServerName('');
    setNewServerCommand('npx');
    setNewServerArgs('-y @modelcontextprotocol/server-');
    setShowAddServerForm(false);
  };
  
  const handleDeleteServer = (serverKey: string) => {
    // Only allow deletion of custom servers, not defaults
    if (Object.keys(availableServers).includes(serverKey)) {
      // For default servers, just deactivate them
      handleToggleServerActive(serverKey);
      return;
    }
    
    // Create new objects without the deleted server
    const { [serverKey]: _, ...remainingConfigs } = serverConfigs;
    const { [serverKey]: __, ...remainingActive } = activeServerStates;
    
    setServerConfigs(remainingConfigs);
    setActiveServerStates(remainingActive);
    
    // Update active servers
    const newActiveServers = { ...activeServers };
    delete newActiveServers[serverKey];
    onSave(newActiveServers);
  };

  // Fix the event handling
  const handleButtonClick = (callback: () => void) => {
    return (e: any) => {
      // Prevent disclosure toggle
      e.stopPropagation?.();
      callback();
    };
  };

  let h = window.innerHeight - SHEET_MARGIN;
  let y = useMotionValue(h);
  let bgOpacity = useTransform(y, [0, h], [0.4, 0]);
  let bg = useMotionTemplate`rgba(0, 0, 0, ${bgOpacity})`;

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionModalOverlay
          isOpen
          onOpenChange={onOpenChange}
          className="fixed inset-0 z-10"
          style={{ backgroundColor: bg as any }}
        >
          <MotionModal
            className="bg-white dark:bg-gray-800 absolute bottom-0 w-full rounded-t-xl shadow-lg will-change-transform"
            initial={{ y: h }}
            animate={{ y: 0 }}
            exit={{ y: h }}
            transition={staticTransition}
            style={{
              y,
              top: SHEET_MARGIN,
              // Extra padding at the bottom to account for rubber band scrolling.
              paddingBottom: window.screen.height
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.y > window.innerHeight * 0.75 || velocity.y > 10) {
                onOpenChange(false);
              } else {
                animate(y, 0, { ...inertiaTransition, min: 0, max: 0 });
              }
            }}
          >
            {/* drag affordance */}
            <div className="mx-auto w-12 mt-2 h-1.5 rounded-full bg-gray-400" />
            <Dialog className="px-4 pb-4 outline-hidden">
              <div className="flex items-center justify-between mb-2">
                <Heading slot="title" className="text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <Server className="w-5 h-5" />
                  Configure MCP Servers
                </Heading>
                <Button
                  variant="secondary"
                  className="p-2 rounded-full"
                  onPress={() => onOpenChange(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Select which Model Context Protocol servers to activate. Toggle the switch to start or stop each server. Click on a server to view its tools.
              </p>
              
              <div className="space-y-1 mb-6 max-h-[60vh] overflow-y-auto">
                <DisclosureGroup>
                  {Object.entries(serverConfigs).map(([key, config]) => (
                    <Disclosure key={key}>
                      {editingServer === key ? (
                        <div className="space-y-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-2">
                          <TextField
                            label="Command"
                            value={config.command}
                            onChange={(val) => setServerConfigs({
                              ...serverConfigs,
                              [key]: { ...config, command: val }
                            })}
                          />
                          <TextField
                            label="Arguments"
                            value={config.args.join(' ')}
                            onChange={(val) => setServerConfigs({
                              ...serverConfigs,
                              [key]: { ...config, args: val.split(' ').filter(arg => arg) }
                            })}
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <Button
                              variant="secondary"
                              onPress={handleButtonClick(() => setEditingServer(null))}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              onPress={handleButtonClick(() => handleUpdateServerConfig(key, serverConfigs[key]))}
                              className="text-xs"
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between py-1 pr-2">
                            <DisclosureHeader>
                              <div className="flex items-center">
                                <div className={`h-3 w-3 rounded-full mr-3 flex-shrink-0 ${getStatusIndicator(key)}`} />
                                <div className="flex-1">
                                  <span className="font-medium">{key}</span>
                                  <div className="flex items-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      {`${config.command} ${config.args.join(' ')}`}
                                    </p>
                                    <span className="text-xs ml-2 px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                                      {getStatusText(key)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </DisclosureHeader>

                            <div className="flex items-center gap-3 ml-2">
                              {/* Single toggle for activation */}
                              <Switch 
                                isSelected={activeServerStates[key]} 
                                onChange={() => handleToggleServerActive(key)}
                              >
                                {activeServerStates[key] ? "Active" : "Inactive"}
                              </Switch>
                              
                              <Button
                                variant="secondary"
                                onPress={handleButtonClick(() => handleEditServer(key))}
                                className="p-1 h-7 w-7 flex items-center justify-center"
                              >
                                <Settings className="h-3 w-3" />
                              </Button>
                              
                              {/* Only show delete for custom servers */}
                              {!Object.keys(availableServers).includes(key) && (
                                <Button
                                  variant="secondary"
                                  onPress={handleButtonClick(() => handleDeleteServer(key))}
                                  className="p-1 h-7 w-7 flex items-center justify-center text-red-500"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <DisclosurePanel>
                            {!activeServerStates[key] ? (
                              <div className="py-2 px-4 text-gray-500 italic">
                                Activate this server to view available tools.
                              </div>
                            ) : serverStatus !== 'READY' ? (
                              <div className="py-2 px-4">
                                <LoadingIndicator
                                  message={`Server is ${serverStatus === 'STARTING' ? 'starting' : 
                                          serverStatus === 'INSTALLING_NODE_MODULES' ? 'installing modules' : 
                                          'not ready'}. Tools will be available when server is ready.`}
                                  variant="spinner"
                                />
                              </div>
                            ) : (
                              <div className="py-2 px-4 space-y-3">
                                <h4 className="text-sm font-medium flex items-center gap-1">
                                  <WrenchIcon className="w-3 h-3" />
                                  Available Tools for {key}:
                                </h4>
                                {/* Get only the tools associated with this server */}
                                {getToolsForServer(key).length > 0 ? (
                                  getToolsForServer(key).map(tool => (
                                    <ActionCard
                                      key={tool.name}
                                      title={tool.name}
                                      className="border border-gray-200 dark:border-gray-700"
                                    >
                                      {tool.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                          {tool.description}
                                        </p>
                                      )}
                                      {tool.inputSchema && (
                                        <div className="text-xs p-2 bg-gray-100 dark:bg-gray-800 rounded-md overflow-x-auto">
                                          <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                                        </div>
                                      )}
                                    </ActionCard>
                                  ))
                                ) : (
                                  <div className="py-2 text-gray-500 italic">
                                    No tools detected for this server.
                                  </div>
                                )}
                              </div>
                            )}
                          </DisclosurePanel>
                        </>
                      )}
                    </Disclosure>
                  ))}
                </DisclosureGroup>
              </div>
              
              {showAddServerForm ? (
                <div className="border p-3 rounded-md mb-4 space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium">Add New Server</h3>
                    <Button
                      variant="secondary"
                      onPress={() => setShowAddServerForm(false)}
                      className="p-1 h-6 w-6 flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <TextField
                    label="Server Name"
                    value={newServerName}
                    onChange={setNewServerName}
                    description="custom-server"
                  />
                  <TextField
                    label="Command"
                    value={newServerCommand}
                    onChange={setNewServerCommand}
                    description="npx"
                  />
                  <TextField
                    label="Arguments"
                    value={newServerArgs}
                    onChange={setNewServerArgs}
                    description="-y @modelcontextprotocol/server-custom"
                  />
                  <Button
                    variant="primary"
                    onPress={handleAddServer}
                    className="w-full mt-2"
                    isDisabled={!newServerName}
                  >
                    Add Server
                  </Button>
                </div>
              ) : (
                <Button
                  onPress={() => setShowAddServerForm(true)}
                  className="w-full py-3 mb-2"
                  variant="secondary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Custom Server
                </Button>
              )}
            </Dialog>
          </MotionModal>
        </MotionModalOverlay>
      )}
    </AnimatePresence>
  );
}

// API Key Alert Dialog Component
interface ApiKeyAlertDialogProps {
  apiKey: string;
  onChange: (apiKey: string) => void;
  isOpen: boolean;
  activeServers: Record<string, ServerConfig>;
  onConfigureServers: () => void;
}

function ApiKeyAlertDialog({ apiKey, onChange, isOpen, activeServers, onConfigureServers }: ApiKeyAlertDialogProps) {
  const [inputValue, setInputValue] = useState(apiKey);
  const [authStatus, setAuthStatus] = useState<'initial' | 'registered' | 'authenticated'>('initial');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if we have a stored encrypted key
  useEffect(() => {
    const hasEncryptedKey = localStorage.getItem('encryptedApiKey') !== null;
    if (hasEncryptedKey) {
      setAuthStatus('registered');
      // Will trigger authentication later after the component is fully mounted
      setTimeout(() => {
        handleAuthenticate();
      }, 100);
    }
  }, []);  // Note: we intentionally don't include handleAuthenticate in deps to avoid infinite loops

  // Reset input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(apiKey);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, apiKey]);

  // Register new WebAuthn credential
  const handleRegister = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Start WebAuthn registration with default username
      const credential = await startRegistration();
      console.log('Registration successful:', credential);
      
      // Encrypt and save API key if provided
      if (inputValue) {
        await encryptAndSaveKey(inputValue);
      }
      
      setAuthStatus('registered');
      setIsLoading(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof WebAuthnError 
        ? err.message 
        : 'Registration failed: ' + (err instanceof Error ? err.message : String(err));
      
      setError(errorMessage);
      console.error(err);
      setIsLoading(false);
    }
  };

  // Authenticate with existing credential
  const handleAuthenticate = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Start WebAuthn authentication
      const assertion = await startAuthentication();
      console.log('Authentication successful:', assertion);
      
      // If we have an encrypted key, decrypt it
      const encryptedKey = localStorage.getItem('encryptedApiKey');
      if (encryptedKey) {
        try {
          // Derive encryption key from authentication data
          // Force as ArrayBuffer to fix TypeScript error
          const encodedId = new TextEncoder().encode(assertion.id);
          const buffer = encodedId.buffer as ArrayBuffer;
          const key = await deriveKey(buffer);
          
          // Decrypt the API key
          const decryptedKey = await decryptData(key, encryptedKey);
          setInputValue(decryptedKey);
          
          // Set authentication status
          setAuthStatus('authenticated');
          
          // Automatically save and close the dialog after a short delay
          setTimeout(() => {
            onChange(decryptedKey);
          }, 500);
        } catch (decryptErr) {
          console.error('Decryption error:', decryptErr);
          setError('Failed to decrypt API key');
        }
      }
      
      setIsLoading(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof WebAuthnError 
        ? err.message 
        : 'Authentication failed: ' + (err instanceof Error ? err.message : String(err));
      
      setError(errorMessage);
      console.error(err);
      setIsLoading(false);
    }
  };

  // Encrypt and save API key
  const encryptAndSaveKey = async (keyToEncrypt: string) => {
    try {
      setIsLoading(true);
      // Re-authenticate to get fresh authentication data
      const assertion = await startAuthentication();
      
      // Derive encryption key from authentication data
      // Force as ArrayBuffer to fix TypeScript error
      const encodedId = new TextEncoder().encode(assertion.id);
      const buffer = encodedId.buffer as ArrayBuffer;
      const key = await deriveKey(buffer);
      
      // Encrypt the API key
      const encrypted = await encryptData(key, keyToEncrypt);
      
      // Save to localStorage
      localStorage.setItem('encryptedApiKey', encrypted);
      setIsLoading(false);
      
      return true;
    } catch (err: unknown) {
      console.error('Error saving encrypted key:', err);
      const errorMessage = 'Failed to securely save API key: ' + 
        (err instanceof Error ? err.message : String(err));
      
      setError(errorMessage);
      setIsLoading(false);
      return false;
    }
  };

  // Handle saving the API key
  const handleSave = async () => {
    // If we have a valid API key and we're authenticated, encrypt and save it
    if (inputValue && authStatus === 'authenticated') {
      const success = await encryptAndSaveKey(inputValue);
      if (success) {
        onChange(inputValue);
      }
    } else if (inputValue) {
      // If not authenticated yet but have a key, just pass it through
      onChange(inputValue);
    } else if (Object.keys(activeServers).length > 0) {
      // No API key but we have servers, so that's ok
      onChange('');
    }
  };

  // Clear stored credentials and encrypted key
  const handleClearCredentials = () => {
    localStorage.removeItem('encryptedApiKey');
    setAuthStatus('initial');
    setInputValue('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <ActionCard
        title="Anthropic API Key"
        icon={<Key className="h-6 w-6" />}
        className="max-w-md w-full"
        actions={
          <div className="flex justify-end gap-2">
            {authStatus === 'initial' && (
              <Button
                variant="primary"
                onPress={handleRegister}
                isDisabled={isLoading}
              >
                {isLoading ? 'Setting up...' : 'Secure with Passkey'}
              </Button>
            )}
            
            {authStatus === 'registered' && (
              <Button
                variant="secondary"
                onPress={handleAuthenticate}
                isDisabled={isLoading}
              >
                {isLoading ? 'Unlocking...' : 'Unlock with Passkey'}
              </Button>
            )}
            
            {authStatus === 'initial' && (
              <Button
                variant="primary"
                onPress={handleSave}
                isDisabled={(!inputValue && Object.keys(activeServers).length === 0) || isLoading}
                autoFocus
              >
                Continue
              </Button>
            )}
          </div>
        }
      >
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {authStatus === 'registered' ? 
            'Please authenticate with your passkey to unlock your API key.' :
            authStatus === 'initial' ? 
              'Please provide your Anthropic API key to use Claude directly. Secure your key with a passkey for encrypted local storage.' :
              'API key unlocked successfully. Proceeding automatically...'}
        </p>
        
        <div className="mb-6">
          <TextField
            type="password"
            label="API Key"
            value={inputValue}
            onChange={setInputValue}
            aria-label="Anthropic API Key"
            isDisabled={authStatus === 'registered'}
          />
        </div>
        
        {authStatus === 'registered' && (
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Authentication required to access your saved API key.
            </p>
            <Button 
              variant="secondary" 
              className="text-xs"
              onPress={handleClearCredentials}
              isDisabled={isLoading}
            >
              Clear Credentials
            </Button>
          </div>
        )}
        
        {authStatus === 'authenticated' && (
          <p className="text-sm text-green-500 dark:text-green-400 mb-4">
            Passkey authenticated. Your API key is ready to use. Proceeding automatically...
          </p>
        )}
        
        {isLoading && (
          <div className="my-2">
            <LoadingIndicator message="Processing your request..." variant="spinner" />
          </div>
        )}
        
        {!inputValue && authStatus !== 'registered' && (
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
            An API key is required for this application.
          </p>
        )}
        
        {error && (
          <div className="mt-2 p-2 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm">
            {error}
          </div>
        )}
      </ActionCard>
    </div>
  );
}

// Error Sheet Component
interface ErrorSheetProps {
  error: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function ErrorSheet({ error, isOpen, onOpenChange }: ErrorSheetProps) {
  let h = window.innerHeight - SHEET_MARGIN;
  let y = useMotionValue(h);
  let bgOpacity = useTransform(y, [0, h], [0.4, 0]);
  let bg = useMotionTemplate`rgba(0, 0, 0, ${bgOpacity})`;

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionModalOverlay
          isOpen
          onOpenChange={onOpenChange}
          className="fixed inset-0 z-10"
          style={{ backgroundColor: bg as any }}
        >
          <MotionModal
            className="bg-white dark:bg-gray-800 absolute bottom-0 w-full rounded-t-xl shadow-lg will-change-transform"
            initial={{ y: h }}
            animate={{ y: 0 }}
            exit={{ y: h }}
            transition={staticTransition}
            style={{
              y,
              top: SHEET_MARGIN,
              paddingBottom: window.screen.height
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.y > window.innerHeight * 0.75 || velocity.y > 10) {
                onOpenChange(false);
              } else {
                animate(y, 0, { ...inertiaTransition, min: 0, max: 0 });
              }
            }}
          >
            {/* drag affordance */}
            <div className="mx-auto w-12 mt-2 h-1.5 rounded-full bg-gray-400" />
            <Dialog className="px-4 pb-4 outline-hidden">
              <ActionCard
                title="Error"
                icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                actions={
                  <Button
                    onPress={() => onOpenChange(false)}
                    variant="primary"
                  >
                    Close
                  </Button>
                }
              >
                <ErrorDisplay error={error || 'An unknown error occurred'} />
              </ActionCard>
            </Dialog>
          </MotionModal>
        </MotionModalOverlay>
      )}
    </AnimatePresence>
  );
}

// Main Chat component (now with server configuration)
export function Chat({ serverConfigs = DEFAULT_SERVER_CONFIGS }: { serverConfigs?: Record<string, ServerConfig> }) {
  const [activeServers, setActiveServers] = useState<Record<string, ServerConfig>>(serverConfigs);
  return (
      <ChatInterface 
        availableServers={serverConfigs} 
        activeServers={activeServers}
        onUpdateServers={setActiveServers}
      />
  );
}

// ChatInterface component handling the chat functionality
function ChatInterface({ 
  availableServers, 
  activeServers, 
  onUpdateServers 
}: { 
  availableServers: Record<string, ServerConfig>;
  activeServers: Record<string, ServerConfig>;
  onUpdateServers: (servers: Record<string, ServerConfig>) => void;
}) {
  // State for API key
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKeyDialog, setShowApiKeyDialog] = useState<boolean>(true);
  const [showServerConfigSheet, setShowServerConfigSheet] = useState<boolean>(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  // Check for encrypted API key in localStorage on init
  useEffect(() => {
    const hasEncryptedKey = localStorage.getItem('encryptedApiKey') !== null;
    
    if (hasEncryptedKey) {
      // Always show the dialog if we have an encrypted key but no active key
      setShowApiKeyDialog(true);
    }
  }, []);
  
  // State for chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'system',
      content: 'I am an AI assistant that can help you with various tasks using tools.',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorSheet, setShowErrorSheet] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get MCP server status and tools using the real hook
  const { status, tools: mcpTools, executeTool, toolToServerMap } = useMCPServer({ mcpServers: activeServers });

  // Keep track of tools with their server assignment
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  
  // Derive the server tool mapping from the toolToServerMap
  const serverToolMapping = toolToServerMap ? 
    Object.fromEntries(Array.from(toolToServerMap.entries())) : {};

  // Update tools when mcpTools changes
  useEffect(() => {
    // When no tools available, clear the list
    if (!mcpTools || !mcpTools.length) {
      setTools([]);
      return;
    }
    
    // The real MCP implementation already knows which tools belong to which server
    // For display, we'll just add the serverName property to each tool
    setTools(mcpTools);
  }, [mcpTools]);

  // Method to call Anthropic API directly
  const callAnthropicAPI = async (messageHistory: { role: string; content: string }[]): Promise<GenerateResponse> => {
    try {
      // Format tools for Anthropic API
      const formattedTools = tools?.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        input_schema: tool.inputSchema || {}
      })) || [];
      
      // Prepare the request body
      const requestBody = {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        messages: messageHistory.filter(msg => msg.role !== 'system'),
        tools: formattedTools,
        system: messageHistory.find(msg => msg.role === 'system')?.content || 
                'You are a helpful assistant with access to tools. Use the provided tools when appropriate to assist the user.'
      };
      
      // Make API request to Anthropic
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Anthropic API error: ${errorData.error?.message || JSON.stringify(errorData)}`);
      }
      
      const responseData = await response.json();
      
      // Process the response
      if (responseData.content && responseData.content.length > 0) {
        // Check if there's a tool_use block
        const toolUseBlock = responseData.content.find((block: any) => block.type === 'tool_use');
        
        if (toolUseBlock) {
          return {
            text: responseData.content.find((block: any) => block.type === 'text')?.text || 'I need to use a tool to help with this.',
            toolCalls: [{
              name: toolUseBlock.name,
              arguments: toolUseBlock.input
            }]
          };
        } else {
          return {
            text: responseData.content[0]?.text || "I couldn't generate a response."
          };
        }
      } else {
        throw new Error('Invalid response from Anthropic API');
      }
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      throw error;
    }
  };

  // Generate a response using MCP or direct Anthropic API call
  const generateResponse = async (messageHistory: { role: string; content: string }[]): Promise<GenerateResponse> => {
    // If API key is set, use direct Anthropic API call
    if (apiKey) {
      return callAnthropicAPI(messageHistory);
    }
    
    // Otherwise, use MCP server if available or fallback to mock responses
    if (status === 'READY' && tools) {
      try {
        // In a real implementation, this would call the MCP server's generate method
        // For now, we'll simulate a response
        
        // Simple response if the input contains a weather query
        const lastMessage = messageHistory[messageHistory.length - 1].content.toLowerCase();
        if (lastMessage.includes('weather') && tools?.some(tool => tool.name === 'get_current_weather')) {
          return {
            text: "I'll check the weather for you.",
            toolCalls: [
              {
                name: 'get_current_weather',
                arguments: {
                  location: 'San Francisco, CA',
                  unit: 'fahrenheit'
                }
              }
            ]
          };
        }
        
        // Simple response if the input contains a search query
        if ((lastMessage.includes('search') || lastMessage.includes('find')) && tools?.some(tool => tool.name === 'search_web')) {
          return {
            text: "Let me search that for you.",
            toolCalls: [
              {
                name: 'search_web',
                arguments: {
                  query: lastMessage.replace(/search for|search|find|look up/gi, '').trim()
                }
              }
            ]
          };
        }
        
        // Default response
        return {
          text: `I received your message: "${lastMessage}". How else can I help you?`
        };
      } catch (error) {
        console.error('Error generating response:', error);
        throw error;
      }
    } else {
      // Fallback response if MCP server is not ready
      return {
        text: "I'm sorry, the server is not ready yet. Please try again in a moment."
      };
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Show error sheet when error is set
  useEffect(() => {
    if (error) {
      setShowErrorSheet(true);
    }
  }, [error]);

  // Clear error when sheet is closed
  useEffect(() => {
    if (!showErrorSheet) {
      setError(null);
    }
  }, [showErrorSheet]);

  // Handle sending a message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!inputValue.trim() || isProcessing) return;
    
    // We now require an API key for all operations
    if (!apiKey) {
      setError("API key is required. Please set your API key.");
      setShowApiKeyDialog(true);
      return;
    }
    
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    setIsProcessing(true);
    
    try {
      // Generate a response using our helper function
      const result = await generateResponse(
        messages.concat(newUserMessage).map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      );
      
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Handle tool call
        const toolCall = result.toolCalls[0];
        
        const assistantMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: result.text || 'I need to use a tool to help with this.',
          timestamp: new Date(),
          toolCall: {
            name: toolCall.name,
            arguments: toolCall.arguments
          }
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Execute the tool
        try {
          const toolResult = await executeTool(toolCall.name, toolCall.arguments);
          
          // Update the message with the tool result
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, toolResult } 
              : msg
          ));
          
          // For Anthropic API with tool results
          if (apiKey) {
            // Format the tool result for Anthropic
            const toolResultRequestBody = {
              model: 'claude-3-7-sonnet-20250219',
              max_tokens: 4000,
              messages: [
                ...messages
                  .filter(msg => msg.role !== 'system')
                  .map(msg => ({ role: msg.role, content: msg.content })),
                { role: 'user', content: newUserMessage.content },
                { 
                  role: 'assistant', 
                  content: [
                    { type: 'text', text: assistantMessage.content },
                    { 
                      type: 'tool_use',
                      id: Date.now().toString(),
                      name: toolCall.name,
                      input: toolCall.arguments
                    }
                  ]
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: Date.now().toString(),
                      content: JSON.stringify(toolResult)
                    }
                  ]
                }
              ],
              system: messages.find(msg => msg.role === 'system')?.content ||
                      'You are a helpful assistant with access to tools. Use the provided tools when appropriate to assist the user.'
            };
            
            // Send the tool result to Anthropic
            const toolResultResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
              },
              body: JSON.stringify(toolResultRequestBody)
            });
            
            if (!toolResultResponse.ok) {
              const errorData = await toolResultResponse.json();
              throw new Error(`Anthropic API error (tool result): ${errorData.error?.message || JSON.stringify(errorData)}`);
            }
            
            const toolResultResponseData = await toolResultResponse.json();
            
            const followUpMessage: ChatMessage = {
              id: Date.now().toString(),
              role: 'assistant',
              content: toolResultResponseData.content[0]?.text || 'Here is what I found.',
              timestamp: new Date()
            };
            
            setMessages(prev => [...prev, followUpMessage]);
          } else {
            // Generate a follow-up response that includes the tool result using MCP
            const followUpResult = await generateResponse([
              ...messages.map(msg => ({
                role: msg.role,
                content: msg.content
              })),
              {
                role: newUserMessage.role,
                content: newUserMessage.content
              },
              {
                role: assistantMessage.role,
                content: assistantMessage.content
              },
              {
                role: 'system',
                content: `Tool '${toolCall.name}' returned: ${JSON.stringify(toolResult)}`
              }
            ]);
            
            const followUpMessage: ChatMessage = {
              id: Date.now().toString(),
              role: 'assistant',
              content: followUpResult.text || 'Here is what I found.',
              timestamp: new Date()
            };
            
            setMessages(prev => [...prev, followUpMessage]);
          }
        } catch (toolError) {
          setError(`Error executing tool: ${toolError}`);
        }
      } else {
        // Regular response without tool call
        const assistantMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: result.text || "I couldn't generate a response.",
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err: any) {
      setError(`Error generating response: ${err.message}`);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Format the timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render a tool call display
  const renderToolCall = (toolCall: { name: string; arguments: Record<string, any> }) => {
    return (
      <ActionCard
        title={`Tool: ${toolCall.name}`}
        icon={<WrenchIcon className="w-4 h-4" />}
        className="mt-2 bg-gray-100 dark:bg-gray-800 border-0 shadow-none"
        headerBgColor="bg-transparent"
      >
        <pre className="text-xs overflow-x-auto p-2 bg-gray-200 rounded dark:bg-gray-700">
          {JSON.stringify(toolCall.arguments, null, 2)}
        </pre>
      </ActionCard>
    );
  };

  // Render a tool result display
  const renderToolResult = (result: any) => {
    return (
      <ActionCard
        title="Tool Result"
        icon={<Wand2 className="w-4 h-4" />}
        className="mt-2 bg-gray-100 dark:bg-gray-800 border-0 shadow-none"
        headerBgColor="bg-transparent"
      >
        <pre className="text-xs overflow-x-auto p-2 bg-gray-200 rounded dark:bg-gray-700">
          {typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}
        </pre>
      </ActionCard>
    );
  };

  const handleClearChat = () => {
    setMessages([{
      id: '1',
      role: 'system',
      content: 'I am an AI assistant that can help you with various tasks using tools.',
      timestamp: new Date()
    }]);
  };

  const handleSaveServerConfig = (selectedServers: Record<string, ServerConfig>) => {
    const previousCount = Object.keys(activeServers).length;
    const newCount = Object.keys(selectedServers).length;
    
    onUpdateServers(selectedServers);
    
    // Show appropriate notification based on the changes
    if (newCount > previousCount) {
      setNotification({
        message: `Server configuration updated: ${newCount - previousCount} server(s) added.`,
        type: 'success'
      });
    } else if (newCount < previousCount) {
      setNotification({
        message: `Server configuration updated: ${previousCount - newCount} server(s) removed.`,
        type: 'info'
      });
    } else if (JSON.stringify(Object.keys(selectedServers).sort()) !== JSON.stringify(Object.keys(activeServers).sort())) {
      setNotification({
        message: 'Server configuration updated: servers changed but count remained the same.',
        type: 'info'
      });
    } else {
      setNotification({
        message: 'No changes to server configuration.',
        type: 'info'
      });
    }
  };

  // Handle API key save
  const handleApiKeySave = (newApiKey: string) => {
    setApiKey(newApiKey);
    
    // Close the dialog if we have a key
    if (newApiKey) {
      setShowApiKeyDialog(false);
      
      const encryptedKeyExists = localStorage.getItem('encryptedApiKey') !== null;
      setNotification({
        message: encryptedKeyExists 
          ? 'Unlocked API key successfully.' 
          : 'API key secured with passkey.',
        type: 'success'
      });
    } else {
      // If no key, show an error
      setNotification({
        message: 'API key is required to use this application.',
        type: 'error'
      });
    }
  };

  // Handle opening server config sheet from API key dialog
  const handleOpenServerConfig = () => {
    setShowServerConfigSheet(true);
  };

  // Clear notification after timeout
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white dark:bg-gray-900">
      {/* API Key Alert Dialog (Non-dismissable) */}
      <ApiKeyAlertDialog
        apiKey={apiKey}
        onChange={handleApiKeySave}
        isOpen={showApiKeyDialog}
        activeServers={activeServers}
        onConfigureServers={handleOpenServerConfig}
      />
      
      {/* Server Configuration Sheet with Tools */}
      <ServerConfigSheet 
        availableServers={availableServers}
        activeServers={activeServers}
        isOpen={showServerConfigSheet}
        onOpenChange={setShowServerConfigSheet}
        onSave={handleSaveServerConfig}
        serverStatus={status}
        tools={tools}
        serverToolMapping={serverToolMapping}
      />
      
      {/* Error Sheet */}
      <ErrorSheet
        error={error}
        isOpen={showErrorSheet}
        onOpenChange={setShowErrorSheet}
      />
      
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <ActionCard
            title={notification.type === 'success' ? 'Success' : 
                   notification.type === 'error' ? 'Error' : 'Information'}
            icon={notification.type === 'success' ? <Check className="w-5 h-5" /> : 
                 notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
                 <Info className="w-5 h-5" />}
            className={notification.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700' : 
                     notification.type === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-900 dark:border-red-700' : 
                     'bg-blue-50 border-blue-200 dark:bg-blue-900 dark:border-blue-700'}
            headerBgColor="bg-transparent"
          >
            <p className={notification.type === 'success' ? 'text-green-700 dark:text-green-200' : 
                        notification.type === 'error' ? 'text-red-700 dark:text-red-200' : 
                        'text-blue-700 dark:text-blue-200'}>
              {notification.message}
            </p>
          </ActionCard>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <Wand2 className="h-5 w-5" />
          <span>AI Chat with Tool Calling</span>
        </h1>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${
            apiKey ? 'bg-gray-500' :
            status === 'READY' ? 'bg-green-500' : 
            status === 'STARTING' || status === 'INSTALLING_NODE_MODULES' ? 'bg-yellow-500 animate-pulse' : 
            'bg-red-500'
          }`} />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {apiKey ? 'Using Anthropic API' :
             status === 'READY' ? `Server Ready (${Object.keys(activeServers).length} active)` : 
             status === 'STARTING' ? 'Starting Server' :
             status === 'INSTALLING_NODE_MODULES' ? 'Installing Modules' :
             'Server Error'}
          </span>
          <Button 
            variant="secondary" 
            className="text-xs px-2 py-1 ml-1 flex items-center gap-1" 
            onPress={() => setShowServerConfigSheet(true)}
          >
            <Server className="h-3 w-3 mr-1" />
            MCP Servers
          </Button>
          <MenuTrigger>
            <Button variant="secondary" className="p-2 h-8 w-8 flex items-center justify-center">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <Menu>
              <MenuItem id="clear" onAction={() => handleClearChat()}>Clear Chat</MenuItem>
              <MenuItem id="settings" onAction={() => setShowApiKeyDialog(true)}>
                {apiKey ? 'Change API Key' : localStorage.getItem('encryptedApiKey') ? 'Unlock API Key' : 'Set API Key'}
              </MenuItem>
              <MenuItem id="servers" onAction={() => setShowServerConfigSheet(true)}>
                Configure Servers
              </MenuItem>
            </Menu>
          </MenuTrigger>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat messages */}
        <div className="flex-1 flex flex-col w-full">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length <= 1 && (
              <ActionCard
                title="Welcome to AI Chat"
                icon={<Wand2 className="w-5 h-5" />}
                className="mx-auto max-w-2xl"
              >
                <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                  {apiKey ? (
                    <p>Start a conversation! Using Anthropic API with your secured key.</p>
                  ) : (
                    <>
                      <p>An Anthropic API key is required to use this application.</p>
                      <p className="mt-2 text-sm">
                        Click the "Set API Key" button in the menu to get started.
                      </p>
                      <Button
                        variant="primary"
                        onPress={() => setShowApiKeyDialog(true)}
                        className="mt-4"
                      >
                        Set API Key
                      </Button>
                    </>
                  )}
                </div>
              </ActionCard>
            )}
            {messages.filter(msg => msg.role !== 'system').map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${
                  message.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-gray-700 text-white dark:bg-gray-600'
                      : message.role === 'system'
                      ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 italic'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}
                >
                  {message.content}
                  {message.toolCall && renderToolCall(message.toolCall)}
                  {message.toolResult && renderToolResult(message.toolResult)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {message.role !== 'system' && formatTime(message.timestamp)}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 max-w-[80%] rounded-lg p-4">
                  <LoadingIndicator message="Processing your request..." variant="spinner" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-4">
            <Form onSubmit={handleSendMessage} className="flex items-end gap-2">
              <TextField
                className="flex-1"
                value={inputValue}
                onChange={setInputValue}
                aria-label="Type a message"
                isDisabled={isProcessing || !apiKey}
                placeholder={!apiKey ? "API key required to use chat" : "Type a message..."}
              />
              <Button
                type="submit"
                isDisabled={isProcessing || !inputValue.trim() || !apiKey}
                className="flex items-center gap-2"
              >
                {isProcessing ? 'Processing...' : 'Send'}
                <Send className="w-4 h-4" />
              </Button>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
} 