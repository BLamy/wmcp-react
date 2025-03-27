import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';

import { Form, DialogTrigger, Checkbox } from 'react-aria-components';
import { Button } from '@/components/aria/Button';
import { TextField } from '../../../components/aria/TextField';
import { MenuTrigger, Modal, ModalOverlay, Dialog, Heading } from 'react-aria-components';
import { WrenchIcon, Wand2, Send, Settings, MoreHorizontal, Plus, AlertCircle, Server, Save, Check, Info, X, Key, Database } from 'lucide-react';
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
import { ChatList } from './ChatList';

import { Tool } from '@modelcontextprotocol/sdk/types';
import { ServerConfig } from '../../lib/McpClientManager';
import { MCPServerStatus, useMCPServer } from '../../hooks/useMcpServer';
import { startRegistration, startAuthentication, WebAuthnError } from '../../lib/webauthn';
import { deriveKey, encryptData, decryptData } from '../../lib/utils';
import { LoadingIndicator } from '../status/LoadingIndicator';
import { ErrorDisplay } from '../status/ErrorDisplay';
import { DatabaseContext } from '../../../pglite/db-context';

// Extend the ToolDefinition type to include serverName
interface ToolDefinition extends Tool {
  serverName?: string;
}

// Define the types for our chat messages
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCall?: {
    id?: string;
    name: string;
    arguments: Record<string, any>;
  };
  toolResult?: any;
  metadata?: Record<string, any>;
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

export function ServerConfigSheet({ 
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

// Main Chat component (now with server configuration and persistence option)
export function Chat({ 
  serverConfigs = DEFAULT_SERVER_CONFIGS, 
  enablePersistence = false,
  sessionId = null
}: { 
  serverConfigs?: Record<string, ServerConfig>;
  enablePersistence?: boolean;
  sessionId?: string | null;
}) {
  const [activeServers, setActiveServers] = useState<Record<string, ServerConfig>>(serverConfigs);
  const [chatSessions, setChatSessions] = useState<{ id: string; name: string; created_at: string; updated_at: string }[]>([]);
  const [showChatList, setShowChatList] = useState<boolean>(false);
  // Track the current session ID regardless of prop
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId);

  // Access database context if persistence is enabled
  const { $raw: db, isInitialized, error: dbError } = useContext(DatabaseContext);
  
  // State for API key
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKeyDialog, setShowApiKeyDialog] = useState<boolean>(true);
  const [showServerConfigSheet, setShowServerConfigSheet] = useState<boolean>(false);
  
  // Chat sessions state
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

  // Add persisted state indicator
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  
  // Format chat sessions for the ChatList component
  const formatChatSessionsForList = (sessions: { id: string; name: string; created_at: string; updated_at: string }[]) => {
    console.log('Formatting chat sessions for list:', sessions.length);
    
    if (!sessions || sessions.length === 0) {
      console.log('No sessions to format');
      return [];
    }
    
    const formattedSessions = sessions.map(session => {
      // For debugging
      console.log(`Formatting session: ${session.id} - ${session.name}`);
      
      return {
        id: session.id,
        sender: 'Chat',
        date: new Date(session.updated_at).toLocaleString(),
        subject: session.name || 'Unnamed Chat',
        message: `Last updated: ${new Date(session.updated_at).toLocaleString()}`
      };
    });
    
    console.log('Formatted sessions:', formattedSessions.length);
    return formattedSessions;
  };

  // Modify loadChatHistory to support loading messages for a specific session
  const loadChatHistory = useCallback(async () => {
    if (!db || !enablePersistence) {
      console.log('Cannot load chat history: DB not available or persistence disabled');
      return;
    }
    
    if (!currentSessionId) {
      console.log('Cannot load chat history: No current session ID');
      return;
    }
    
    console.log(`Loading chat history for session ID: ${currentSessionId}`);
    
    try {
      // Force clear messages first to ensure UI updates
      setMessages([]);
      
      const query = `
        SELECT id, role, content, date, metadata 
        FROM chat_messages 
        WHERE session_id = '${currentSessionId}' 
        ORDER BY date ASC
      `;
      
      const result = await db.query<{ id: string; role: string; content: string; date: string; metadata: string }>(query);
      
      console.log(`Found ${result.rows.length} messages for current session ${currentSessionId}`);
      
      if (result.rows.length === 0) {
        console.log('No messages found for current session, adding default system message');
        const systemMessage = {
          id: `msg-default-${Date.now()}`,
          role: 'system' as 'system',
          content: 'I am an AI assistant that can help you with various tasks using tools.',
          timestamp: new Date(),
          metadata: { session_id: currentSessionId }
        };
        
        setMessages([systemMessage]);
        
        // Save the system message to the database
        await db.exec(`
          INSERT INTO chat_messages (id, role, content, date, session_id, metadata)
          VALUES (
            '${systemMessage.id}',
            '${systemMessage.role}',
            '${systemMessage.content.replace(/'/g, "''")}',
            CURRENT_TIMESTAMP,
            '${currentSessionId}',
            '{}'
          )
        `);
        
        return;
      }
      
      const loadedMessages: ChatMessage[] = [];
      
      for (const row of result.rows) {
        try {
          // Safely parse metadata with fallback
          let parsedMetadata = {};
          if (row.metadata) {
            try {
              parsedMetadata = row.metadata !== 'null' && row.metadata !== '{}' 
                ? JSON.parse(row.metadata) 
                : {};
            } catch (err) {
              console.warn(`Failed to parse metadata for message ${row.id}`, err);
            }
          }
          
          const message: ChatMessage = {
            id: row.id,
            role: row.role as 'system' | 'user' | 'assistant' | 'tool',
            content: row.content,
            timestamp: new Date(row.date),
            metadata: { ...parsedMetadata, session_id: currentSessionId },
          };
          
          // Check if this message has tool calls
          if (row.role === 'assistant') {
            try {
              const toolCallsResult = await db.query<{ id: string; function_name: string; arguments: string }>(
                `SELECT id, function_name, arguments FROM tool_calls WHERE message_id = '${row.id}'`
              );
              
              if (toolCallsResult.rows.length > 0) {
                const toolCallRow = toolCallsResult.rows[0];
                let parsedArgs = {};
                
                try {
                  parsedArgs = JSON.parse(toolCallRow.arguments);
                } catch (err) {
                  console.warn(`Failed to parse tool call arguments for message ${row.id}`, err);
                }
                
                message.toolCall = {
                  id: toolCallRow.id,
                  name: toolCallRow.function_name,
                  arguments: parsedArgs
                };
              }
            } catch (err) {
              console.error(`Error loading tool calls for message ${row.id}:`, err);
            }
          }
          
          loadedMessages.push(message);
        } catch (err) {
          console.error(`Error processing message ${row.id}:`, err);
        }
      }
      
      console.log(`Setting messages state with ${loadedMessages.length} loaded messages`);
      setMessages(loadedMessages);
      
      // Force scroll to bottom after messages load
      setTimeout(() => {
        if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
    } catch (error) {
      console.error('Error loading chat history:', error);
      // Set empty messages array on error to avoid showing stale data
      setMessages([]);
    }
  }, [db, enablePersistence, currentSessionId]);
  
  // Load chat sessions from database if persistence is enabled
  const loadChatSessions = useCallback(async () => {
    if (!db || !enablePersistence) {
      console.log('Database not available or persistence not enabled');
      return;
    }
    
    try {
      // Check if tables exist and create them if they don't
      console.log('Starting loadChatSessions...');
      
      // Query for all chat sessions ordered by updated_at
      const sessionsResult = await db.query<{ id: string; name: string; created_at: string; updated_at: string }>(
        'SELECT id, name, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC'
      );
      
      console.log(`Found ${sessionsResult.rows.length} chat sessions:`, JSON.stringify(sessionsResult.rows, null, 2));
      
      if (sessionsResult.rows.length === 0) {
        // Create a default session if none exist
        const defaultSessionId = `session-${Date.now()}`;
        console.log(`Creating default session with ID: ${defaultSessionId}`);
        await db.exec(`
          INSERT INTO chat_sessions (id, name, created_at, updated_at)
          VALUES ('${defaultSessionId}', 'New Chat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        
        // Add default welcome message
        await db.exec(`
          INSERT INTO chat_messages (id, role, content, date, session_id)
          VALUES ('msg-welcome-${Date.now()}', 'system', 'Welcome to your new chat!', CURRENT_TIMESTAMP, '${defaultSessionId}')
        `);
        
        // Set current session to the default one
        setCurrentSessionId(defaultSessionId);
        
        // Load sessions again
        const newSessionsResult = await db.query<{ id: string; name: string; created_at: string; updated_at: string }>(
          'SELECT id, name, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC'
        );
        
        console.log('New sessions after creating default:', JSON.stringify(newSessionsResult.rows, null, 2));
        setChatSessions(newSessionsResult.rows);
        console.log('Updated chat sessions state with default session');
      } else {
        setChatSessions(sessionsResult.rows);
        console.log('Updated chat sessions state with existing sessions:', JSON.stringify(sessionsResult.rows, null, 2));
        
        // If currentSessionId is not set, use the most recent session
        if (!currentSessionId) {
          const mostRecentSession = sessionsResult.rows[0].id;
          console.log(`Setting current session to most recent: ${mostRecentSession}`);
          setCurrentSessionId(mostRecentSession);
          
          // Load messages for this session since we just set it
          setTimeout(() => loadChatHistory(), 0);
        }
      }
      
      // Always ensure chat list is visible when loading sessions
      setShowChatList(true);
      
      // Log the current state for debugging
      console.log('Chat sessions state: ', {
        enablePersistence,
        currentSessionId,
        sessionsCount: sessionsResult.rows.length,
        chatSessionsState: chatSessions.length
      });
      
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  }, [db, enablePersistence, currentSessionId, loadChatHistory]);

  // Make sure we load the chat sessions when the component initializes
  useEffect(() => {
    if (enablePersistence && db && isInitialized) {
      console.log('Loading chat sessions on component initialization');
      loadChatSessions();
    }
  }, [enablePersistence, db, isInitialized, loadChatSessions]);

  // Handle session selection - load the selected session's messages
  const handleSessionSelect = useCallback(async (selectedSessionId: string) => {
    console.log('handleSessionSelect called with ID:', selectedSessionId);
    
    if (!db) {
      console.error('Database not available');
      return;
    }
    
    try {
      // Set the current session ID
      setCurrentSessionId(selectedSessionId);
      console.log('Current session ID set to:', selectedSessionId);
      
      // Update session's updated_at timestamp
      await db.exec(`
        UPDATE chat_sessions
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = '${selectedSessionId}'
      `);
      
      // Refresh chat sessions list
      await loadChatSessions();
      
      // Load messages for this session directly
      await loadChatHistory();
      
      // Hide chat list after selection on mobile
      if (window.innerWidth < 768) {
        setShowChatList(false);
      }
      
    } catch (error) {
      console.error('Error selecting chat session:', error);
      setError(`Error loading chat session: ${error}`);
    }
  }, [db, loadChatHistory, loadChatSessions]);

  // Add debug function to create multiple test sessions
  const createTestSessions = async () => {
    if (!db) return;
    
    try {
      console.log("Creating 5 test chat sessions");
      
      for (let i = 1; i <= 5; i++) {
        const testId = `test-session-${Date.now()}-${i}`;
        await db.exec(`
          INSERT INTO chat_sessions (id, name, created_at, updated_at)
          VALUES ('${testId}', 'Test Chat ${i}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        
        // Add a sample message
        await db.exec(`
          INSERT INTO chat_messages (id, role, content, date, session_id)
          VALUES (
            'test-msg-${Date.now()}-${i}', 
            'system', 
            'This is test chat ${i}', 
            CURRENT_TIMESTAMP, 
            '${testId}'
          )
        `);
        
        console.log(`Created test session ${i} with ID: ${testId}`);
      }
      
      // Reload sessions
      await loadChatSessions();
      
      // Force show chat list
      setShowChatList(true);

    } catch (error) {
      console.error('Error creating test sessions:', error);
    }
  };

  // Add a clear all sessions function for debugging
  const clearAllSessions = async () => {
    if (!db) return;
    
    try {
      // Delete all messages and sessions
      await db.exec('DELETE FROM chat_messages');
      await db.exec('DELETE FROM tool_calls');
      await db.exec('DELETE FROM chat_sessions');
      
      // Reset current state
      setCurrentSessionId(null);
      setMessages([{
        id: Date.now().toString(),
        role: 'system',
        content: 'I am an AI assistant that can help you with various tasks using tools.',
        timestamp: new Date()
      }]);
      
      // Reload sessions (should be empty)
      await loadChatSessions();

    } catch (error) {
      console.error('Error clearing sessions:', error);
    }
  };

  // Add function to handle session deletion
  const handleDeleteSession = useCallback(async (sessionIdToDelete: string) => {
    if (!db) return;
    
    try {
      // Delete messages with this session_id
      await db.exec(`DELETE FROM chat_messages WHERE session_id = '${sessionIdToDelete}'`);
      
      // Delete the session
      await db.exec(`DELETE FROM chat_sessions WHERE id = '${sessionIdToDelete}'`);
      
      // Reload sessions
      await loadChatSessions();
      
      // Clear messages if currently viewing this session
      if (currentSessionId === sessionIdToDelete) {
        setCurrentSessionId(null);
        setMessages([{
          id: Date.now().toString(),
          role: 'system',
          content: 'I am an AI assistant that can help you with various tasks using tools.',
          timestamp: new Date()
        }]);
      }
      
    } catch (error) {
      console.error('Error deleting chat session:', error);
      setError(`Error deleting chat session: ${error}`);
    }
  }, [db, currentSessionId, loadChatSessions]);

  // Watch for changes to currentSessionId and load the appropriate chat history
  useEffect(() => {
    if (enablePersistence && currentSessionId && isInitialized && db) {
      console.log(`[useEffect] Loading chat history for session ID: ${currentSessionId}`);
      loadChatHistory();
    }
  }, [enablePersistence, currentSessionId, loadChatHistory, isInitialized, db]);

  // Handle API key save
  const handleApiKeySave = (newApiKey: string) => {
    setApiKey(newApiKey);
    
    // Close the dialog if we have a key
    if (newApiKey) {
      setShowApiKeyDialog(false);     
    } 
  };

  // Handle opening server config sheet from API key dialog
  const handleOpenServerConfig = () => {
    setShowServerConfigSheet(true);
  };

  // Server config save handler
  const handleSaveServerConfig = (selectedServers: Record<string, ServerConfig>) => {
    const previousCount = Object.keys(activeServers).length;
    const newCount = Object.keys(selectedServers).length;
    
    setActiveServers(selectedServers);
  };

  // Function to clear chat messages
  const handleClearChat = () => {
    // Keep only the system message
    const systemMessage = messages.find(msg => msg.role === 'system');
    setMessages(systemMessage ? [systemMessage] : []);
  
  };

  // Create a new chat session
  const handleNewChat = useCallback(async () => {
    if (!db) return;
    
    try {
      // Create new session with a unique ID
      const newSessionId = `session-${Date.now()}`;
      console.log(`Creating new chat session with ID: ${newSessionId}`);
      
      await db.exec(`
        INSERT INTO chat_sessions (id, name, created_at, updated_at)
        VALUES ('${newSessionId}', 'New Chat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      // Set current session ID to the new session and show chat immediately
      setCurrentSessionId(newSessionId);
      
      // Reset messages with just a system message
      const systemMessage = {
        id: `msg-${Date.now()}`,
        role: 'system' as 'system',
        content: 'I am an AI assistant that can help you with various tasks using tools.',
        timestamp: new Date(),
        metadata: { session_id: newSessionId }
      };
      
      setMessages([systemMessage]);
      
      // Save the system message to the database
      await db.exec(`
        INSERT INTO chat_messages (id, role, content, date, session_id, metadata)
        VALUES (
          '${systemMessage.id}',
          '${systemMessage.role}',
          '${systemMessage.content.replace(/'/g, "''")}',
          CURRENT_TIMESTAMP,
          '${newSessionId}',
          '{}'
        )
      `);
      
      // Reload sessions to show the new one
      await loadChatSessions();
      
      // Make sure chat list is visible
      setShowChatList(true);
      
      console.log(`New chat session created with ID: ${newSessionId}`);
      
    } catch (error) {
      console.error('Error creating new chat:', error);
      setError(`Error creating new chat: ${error}`);
    }
  }, [db, loadChatSessions]);

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

  // Format the timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle sending a message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!inputValue.trim() || isProcessing) return;
    
    // We require an API key for all operations
    if (!apiKey) {
      console.error('API key is required but not provided');
      setError("API key is required. Please set your API key.");
      setShowApiKeyDialog(true);
      return;
    }
    
    // Basic validation of API key format
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      console.error('API key appears to be invalid (should start with sk- and be longer)');
      setError("API key appears to be in an invalid format. Please check your API key.");
      setShowApiKeyDialog(true);
      return;
    }
    
    console.log('API key validation passed, proceeding with message send');
    
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };
    
    // Check if we need to create a new session for this message
    if (enablePersistence && !currentSessionId) {
      try {
        // Create a new default session
        const newSessionId = `session-${Date.now()}`;
        await db?.exec(`
          INSERT INTO chat_sessions (id, name, created_at, updated_at)
          VALUES ('${newSessionId}', 'New Chat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        setCurrentSessionId(newSessionId);
      } catch (error) {
        console.error('Error creating new session for message:', error);
      }
    }
    
    // Add the message to the UI
    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    setIsProcessing(true);
    
    // Save message to database if persistence is enabled
    if (enablePersistence && db && currentSessionId) {
      try {
        // Save the message to the database
        await db.exec(`
          INSERT INTO chat_messages (id, role, content, date, session_id, metadata)
          VALUES (
            '${newUserMessage.id}',
            '${newUserMessage.role}',
            '${newUserMessage.content.replace(/'/g, "''")}',
            CURRENT_TIMESTAMP,
            '${currentSessionId}',
            '{}'
          )
        `);
        
        // Update session name with the user message if it's "New Chat"
        const sessionResult = await db.query<{ name: string }>(
          `SELECT name FROM chat_sessions WHERE id = '${currentSessionId}'`
        );
        
        if (sessionResult.rows.length > 0 && sessionResult.rows[0].name === 'New Chat') {
          // Use the first 20 characters of the user message as the session name
          const newName = inputValue.length > 20
            ? inputValue.substring(0, 20) + '...'
            : inputValue;
            
          await db.exec(`
            UPDATE chat_sessions
            SET name = '${newName.replace(/'/g, "''")}',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = '${currentSessionId}'
          `);
          
          // Refresh sessions list to show updated name
          await loadChatSessions();
        }
      } catch (error) {
        console.error('Error saving message:', error);
      }
    }
    
    try {
      // Format all previous messages for the API call
      const formattedMessages = messages.map(msg => {
        // Skip system messages as we'll add them separately
        if (msg.role === 'system') return null;
        
        // Format the message for Claude API
        return {
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        };
      }).filter(Boolean) as {role: 'user' | 'assistant', content: string}[];
      
      // Add the new user message
      formattedMessages.push({
        role: 'user',
        content: inputValue
      });
      
      // Set the system message from our system message in the chat
      const systemMessage = messages.find(msg => msg.role === 'system')?.content || 
        'I am an AI assistant that can help you with various tasks using tools.';
      
      console.log('Calling Anthropic API directly...');
      
      // Format the tools properly for Claude API
      const formattedTools = tools.map(tool => {
        // Ensure we have a proper schema for the tool
        let schema = {};
        
        // Check various properties where schema might be stored
        if ('inputSchema' in tool && tool.inputSchema) {
          schema = tool.inputSchema;
        } else if ('parameters' in tool && tool.parameters) {
          schema = tool.parameters;
        } else if ('input_schema' in tool && tool.input_schema) {
          schema = tool.input_schema;
        }
        
        return {
          name: tool.name,
          description: tool.description || `Tool: ${tool.name}`,
          input_schema: schema
        };
      });
      
      console.log('Sending tools to Claude:', formattedTools);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 4000,
          messages: formattedMessages,
          system: systemMessage,
          tools: formattedTools
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Claude API error response:', errorData);
        throw new Error(`Claude API request failed: ${response.status} ${response.statusText} - ${errorData}`);
      }
      
      const data = await response.json();
      console.log('Claude API response received:', data);
      
      // Extract the assistant's response
      let assistantContent = '';
      const toolCalls = [];
      
      // Handle different response formats
      if (data && data.content) {
        console.log('Processing Claude API response with content array:', data.content);
        // Find text content and tool use
        for (const contentItem of data.content) {
          console.log('Processing content item:', contentItem);
          if (contentItem.type === 'text') {
            assistantContent = contentItem.text || '';
            console.log('Found text content:', assistantContent);
          } else if (contentItem.type === 'tool_use') {
            const toolCall = {
              id: contentItem?.id || `tool-${Date.now()}`,
              name: contentItem?.name || 'unknown-tool',
              input: contentItem?.input || {}
            };
            console.log('Found tool call:', toolCall);
            toolCalls.push(toolCall);
          }
        }
      } else {
        // Fallback for unexpected response format
        console.error('Unexpected Claude API response format:', data);
        assistantContent = 'Received a response in an unexpected format.';
      }
      
      // Create the assistant message
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date()
      };
      
      // Add tool calls if any
      if (toolCalls.length > 0) {
        const toolCall = toolCalls[0]; // Just handle the first tool call for now
        assistantMessage.toolCall = {
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.input
        };
        
        // Execute the tool if possible
        if (executeTool) {
          try {
            debugger
            const toolResult = await executeTool(toolCall.name, toolCall.input);
            assistantMessage.toolResult = toolResult;
            
            // Send the tool result back to Anthropic
            const toolResultRequestBody = {
              model: 'claude-3-7-sonnet-20250219',
              max_tokens: 4000,
              messages: [
                ...formattedMessages,
                { 
                  role: 'assistant', 
                  content: [
                    { type: 'text', text: assistantContent },
                    { 
                      type: 'tool_use',
                      id: toolCall.id,
                      name: toolCall.name,
                      input: toolCall.input
                    }
                  ]
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: toolCall.id,
                      content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
                    }
                  ]
                }
              ],
              system: systemMessage
            };
            
            console.log('Sending tool result to Anthropic:', toolResultRequestBody);
            
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
              const errorData = await toolResultResponse.text();
              console.error('Claude API tool result error:', errorData);
              throw new Error(`Anthropic API error (tool result): ${toolResultResponse.status} ${toolResultResponse.statusText}`);
            }
            
            const toolResultData = await toolResultResponse.json();
            console.log('Tool result response from Anthropic:', toolResultData);
            
            // Get the follow-up response text
            let followUpText = '';
            if (toolResultData.content) {
              for (const item of toolResultData.content) {
                if (item.type === 'text') {
                  followUpText = item.text;
                  break;
                }
              }
            }
            
            if (followUpText) {
              const followUpMessage: ChatMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: followUpText,
                timestamp: new Date()
              };
              
              // Add the follow-up message
              setMessages(prev => [...prev, assistantMessage, followUpMessage]);
              
              // Save both messages if persistence enabled
              if (enablePersistence && db && currentSessionId) {
                try {
                  // Save the assistant message
                  await db.exec(`
                    INSERT INTO chat_messages (id, role, content, date, session_id, metadata)
                    VALUES (
                      '${assistantMessage.id}',
                      '${assistantMessage.role}',
                      '${assistantMessage.content.replace(/'/g, "''")}',
                      CURRENT_TIMESTAMP,
                      '${currentSessionId}',
                      '${JSON.stringify({
                        toolCall: assistantMessage.toolCall,
                        toolResult: assistantMessage.toolResult
                      }).replace(/'/g, "''")}'
                    )
                  `);
                  
                  // Save tool call
                  if (assistantMessage.toolCall) {
                    await db.exec(`
                      INSERT INTO tool_calls (id, message_id, function_name, arguments)
                      VALUES (
                        '${assistantMessage.toolCall.id}',
                        '${assistantMessage.id}',
                        '${assistantMessage.toolCall.name}',
                        '${JSON.stringify(assistantMessage.toolCall.arguments).replace(/'/g, "''")}'
                      )
                    `);
                  }
                  
                  // Save the follow-up message
                  await db.exec(`
                    INSERT INTO chat_messages (id, role, content, date, session_id, metadata)
                    VALUES (
                      '${followUpMessage.id}',
                      '${followUpMessage.role}',
                      '${followUpMessage.content.replace(/'/g, "''")}',
                      CURRENT_TIMESTAMP,
                      '${currentSessionId}',
                      '{}'
                    )
                  `);
                } catch (error) {
                  console.error('Error saving assistant messages:', error);
                }
              }
              
              setIsProcessing(false);
              return;
            }
          } catch (error: any) {
            console.error(`Error executing tool ${toolCall.name}:`, error);
            assistantMessage.toolResult = { error: `Failed to execute tool: ${error.message || String(error)}` };
          }
        }
      }
      
      // Add the assistant message to the UI
      setMessages(prev => [...prev, assistantMessage]);
      
      // Save assistant message to database if persistence is enabled
      if (enablePersistence && db && currentSessionId) {
        try {
          // Save the message to the database
          await db.exec(`
            INSERT INTO chat_messages (id, role, content, date, session_id, metadata)
            VALUES (
              '${assistantMessage.id}',
              '${assistantMessage.role}',
              '${assistantMessage.content.replace(/'/g, "''")}',
              CURRENT_TIMESTAMP,
              '${currentSessionId}',
              '${JSON.stringify({
                toolCall: assistantMessage.toolCall,
                toolResult: assistantMessage.toolResult
              }).replace(/'/g, "''")}'
            )
          `);
          
          // Save tool call if present
          if (assistantMessage.toolCall) {
            await db.exec(`
              INSERT INTO tool_calls (id, message_id, function_name, arguments)
              VALUES (
                '${assistantMessage.toolCall.id || `tool-${Date.now()}`}',
                '${assistantMessage.id}',
                '${assistantMessage.toolCall.name}',
                '${JSON.stringify(assistantMessage.toolCall.arguments).replace(/'/g, "''")}'
              )
            `);
          }
        } catch (error) {
          console.error('Error saving assistant message:', error);
        }
      }
    } catch (error: any) {
      console.error('Error generating response:', error);
      
      // Extract the most useful error message
      let errorMessage = 'Error generating response';
      
      if (error.message) {
        // Check if it's a Claude API error with details
        if (error.message.includes('Claude API request failed')) {
          // Try to extract the HTTP status and any JSON error details
          const statusMatch = error.message.match(/(\d{3})/);
          const statusCode = statusMatch ? statusMatch[1] : 'unknown';
          
          if (statusCode === '401') {
            errorMessage = 'Authentication failed. Your API key may be invalid or expired.';
          } else if (statusCode === '429') {
            errorMessage = 'Rate limit exceeded. Please try again in a moment.';
          } else if (statusCode === '500') {
            errorMessage = 'Claude API server error. Please try again later.';
          } else {
            errorMessage = `Claude API error (${statusCode}): ${error.message.split('-').pop()?.trim() || 'Unknown error'}`;
          }
        } else {
          // For other errors, just use the message
          errorMessage = error.message;
        }
      }
      
      // Create an error message
      const errorResponse: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      };
      
      // Add the error message to the UI
      setMessages(prev => [...prev, errorResponse]);
      
      // Show the error in the error sheet
      setError(errorMessage);
      setShowErrorSheet(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Initialize database tables if needed
  const initializeDatabase = useCallback(async () => {
    if (!db || !enablePersistence || !isInitialized) {
      console.log('Cannot initialize database: DB not available, persistence disabled, or not initialized');
      return;
    }
    
    try {
      console.log('Initializing database tables...');
      
      // Create chat_sessions table if it doesn't exist
      await db.exec(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL
        )
      `);
      
      // Create chat_messages table if it doesn't exist
      await db.exec(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          date TIMESTAMP NOT NULL,
          session_id TEXT NOT NULL,
          metadata TEXT,
          FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
        )
      `);
      
      // Create tool_calls table if it doesn't exist
      await db.exec(`
        CREATE TABLE IF NOT EXISTS tool_calls (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          function_name TEXT NOT NULL,
          arguments TEXT,
          result TEXT,
          FOREIGN KEY (message_id) REFERENCES chat_messages(id)
        )
      `);
      
      console.log('Database tables initialized successfully');
      setIsPersisted(true);
      
      // Load chat sessions after initializing the database
      await loadChatSessions();
    } catch (error) {
      console.error('Error initializing database tables:', error);
      setError(`Error initializing database: ${error}`);
    }
  }, [db, enablePersistence, isInitialized, loadChatSessions]);

  // Initialize database when component mounts and DB is ready
  useEffect(() => {
    if (enablePersistence && db && isInitialized && !isPersisted) {
      console.log('Database is ready, initializing...');
      initializeDatabase();
    }
  }, [enablePersistence, db, isInitialized, isPersisted, initializeDatabase]);

  // Debug logging for chat sessions rendering
  useEffect(() => {
    if (enablePersistence && chatSessions.length > 0) {
      console.log('Rendering ChatList with:', {
        sessionCount: chatSessions.length,
        formattedMessages: formatChatSessionsForList(chatSessions).length,
        currentSessionId
      });
    }
  }, [chatSessions, currentSessionId, enablePersistence]);

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
        availableServers={serverConfigs}
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
      
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <Wand2 className="h-5 w-5" />
          <span>AI Chat with Tool Calling</span>
          {enablePersistence && (
            <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Database className="h-3 w-3" />
              DB {isInitialized ? 'Connected' : dbError ? 'Error' : 'Connecting...'}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          {/* Server status indicator */}
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

          {/* Show database error if any */}
          {enablePersistence && dbError && (
            <span className="text-xs text-red-600 dark:text-red-400">
              DB Error: {dbError.message}
            </span>
          )}

          {enablePersistence && (
            <Button 
              variant={showChatList ? "primary" : "secondary"}
              className="text-xs px-2 py-1 ml-1 flex items-center gap-1" 
              onPress={() => {
                console.log('Toggling showChatList', !showChatList);
                setShowChatList(!showChatList);
              }}
            >
              {showChatList ? 'Hide Chats' : 'Show Chats'}
            </Button>
          )}

          {enablePersistence && (
            <Button 
              variant="secondary" 
              className="text-xs px-2 py-1 ml-1 flex items-center gap-1" 
              onPress={handleNewChat}
            >
              <Plus className="h-3 w-3 mr-1" />
              New Chat
            </Button>
          )}

          {/* Add debug buttons for testing */}
          {enablePersistence && (
            <>
              <Button 
                variant="secondary" 
                className="text-xs px-2 py-1 ml-1 flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900" 
                onPress={createTestSessions}
              >
                Create Test Chats
              </Button>
              <Button 
                variant="secondary" 
                className="text-xs px-2 py-1 ml-1 flex items-center gap-1 bg-red-100 dark:bg-red-900" 
                onPress={clearAllSessions}
              >
                Clear All
              </Button>
            </>
          )}

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
              {enablePersistence && (
                <MenuItem id="new-chat" onAction={handleNewChat}>New Chat</MenuItem>
              )}
            </Menu>
          </MenuTrigger>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat List Panel (conditionally rendered) */}
        {enablePersistence && showChatList && (
          <div className="w-1/4 min-w-[250px] border-r border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-medium">Chat History</h2>
              <Button 
                variant="secondary" 
                className="flex items-center text-xs px-2 py-1"
                onPress={handleNewChat}
              >
                <Plus className="h-3 w-3 mr-1" />
                New
              </Button>
            </div>
            {chatSessions.length > 0 ? (
              <div className="h-full overflow-auto">
                {/* Log chat list details for debugging */}
                <ChatList 
                  messages={formatChatSessionsForList(chatSessions)} 
                  onMessageClick={(sessionId) => {
                    console.log('ChatList onMessageClick called with:', sessionId);
                    handleSessionSelect(sessionId);
                  }}
                  onMessageDelete={(sessionId) => {
                    console.log('ChatList onMessageDelete called with:', sessionId);
                    handleDeleteSession(sessionId);
                  }}
                  selectedId={currentSessionId || undefined}
                />
              </div>
            ) : (
              <div className="p-4 text-gray-500 text-center">
                <p>No chat sessions found</p>
                <Button 
                  variant="secondary" 
                  className="mt-2"
                  onPress={handleNewChat}
                >
                  Create New Chat
                </Button>
              </div>
            )}
          </div>
        )}

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