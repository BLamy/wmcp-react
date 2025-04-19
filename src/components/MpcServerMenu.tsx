import React, { useState, useEffect } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ServerConfig } from "@/wmcp/lib/McpClientManager";
import { Server, AlertCircle, CheckCircle2, PlusCircle, XCircle, Terminal, ArrowRight } from "lucide-react";
import { MCPServerStatus } from "@/wmcp/hooks/useMcpServer";
import { cn } from "@/lib/utils";

interface MpcServerMenuProps {
  serverConfigs: Record<string, ServerConfig>;
  activeServers: Record<string, ServerConfig>;
  serverStatus?: MCPServerStatus | null;
  webContainerReady?: boolean;
  onSelectServer: (serverName: string) => void;
  onRemoveServer?: (serverName: string) => void;
  onAddCustomServer?: (name: string, command: string, args: string) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function MpcServerMenu({
  serverConfigs,
  activeServers,
  serverStatus,
  webContainerReady = false,
  onSelectServer,
  onRemoveServer,
  onAddCustomServer,
  isOpen,
  onOpenChange,
}: MpcServerMenuProps) {
  const [search, setSearch] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCommand, setCustomCommand] = useState("npx");
  const [customArgs, setCustomArgs] = useState("-y @modelcontextprotocol/server-");
  
  const activeServerCount = Object.keys(activeServers).length;
  const activeServerNames = Object.keys(activeServers);

  // Focus the name input when showing the form
  useEffect(() => {
    if (showCustomForm) {
      // Reset search when showing form
      setSearch("");
      
      // Short delay to ensure input is rendered
      setTimeout(() => {
        const nameInput = document.querySelector('input[placeholder="custom-server"]') as HTMLInputElement;
        if (nameInput) {
          nameInput.focus();
        }
      }, 50);
    }
  }, [showCustomForm]);

  const getStatusIndicator = (serverKey: string) => {
    const isActive = activeServers && !!activeServers[serverKey];
    
    if (!webContainerReady) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    
    if (isActive) {
      if (serverStatus === "READY") {
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      } else if (serverStatus === "ERROR") {
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      } else {
        // Loading or other states
        return (
          <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        );
      }
    }
    
    return activeServerCount > 0 ? 
      <PlusCircle className="h-4 w-4 text-blue-500" /> : 
      <div className="h-4 w-4 rounded-full bg-gray-500" />;
  };

  const getStatusText = (serverKey: string) => {
    const isActive = activeServers && !!activeServers[serverKey];
    
    if (!webContainerReady) {
      return "WebContainer not ready";
    }
    
    if (isActive) {
      if (serverStatus === "READY") {
        return "Active";
      } else if (serverStatus === "ERROR") {
        return "Error";
      } else {
        return "Initializing...";
      }
    }
    
    return activeServerCount > 0 ? "Add server" : "Available";
  };

  const handleAddCustomServer = () => {
    if (!customName.trim()) {
      return;
    }
    
    if (onAddCustomServer) {
      onAddCustomServer(customName, customCommand, customArgs);
      
      // Reset form
      setCustomName("");
      setCustomCommand("npx");
      setCustomArgs("-y @modelcontextprotocol/server-");
      setShowCustomForm(false);
      
      // Close menu
      onOpenChange(false);
    }
  };

  // Reset form when closing the dialog
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShowCustomForm(false);
      setCustomName("");
      setCustomCommand("npx");
      setCustomArgs("-y @modelcontextprotocol/server-");
    }
    onOpenChange(open);
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
      <Command className="rounded-lg border shadow-md">
        <CommandInput
          placeholder={showCustomForm ? "Enter server details..." : "Search MPC servers..."}
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No servers found.</CommandEmpty>
          
          {/* Custom Server Form */}
          {showCustomForm ? (
            <div className="p-2 space-y-2 border-b border-[#3c3c3c]">
              <h3 className="text-sm font-semibold text-white px-2 py-1">Add Custom Server</h3>
              <div className="space-y-2">
                <div className="px-2">
                  <label className="block text-xs text-gray-400 mb-1">Server Name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="custom-server"
                    className="w-full bg-[#3c3c3c] text-white text-sm px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="px-2">
                  <label className="block text-xs text-gray-400 mb-1">Command</label>
                  <input
                    type="text"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder="npx"
                    className="w-full bg-[#3c3c3c] text-white text-sm px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="px-2">
                  <label className="block text-xs text-gray-400 mb-1">Arguments</label>
                  <input
                    type="text"
                    value={customArgs}
                    onChange={(e) => setCustomArgs(e.target.value)}
                    placeholder="-y @modelcontextprotocol/server-memory"
                    className="w-full bg-[#3c3c3c] text-white text-sm px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="px-2 text-xs text-gray-400 italic">
                  Example: <span className="text-blue-400">npx -y @modelcontextprotocol/server-memory</span>
                </div>
                <div className="flex justify-end space-x-2 px-2 py-2">
                  <button
                    onClick={() => setShowCustomForm(false)}
                    className="px-2 py-1 text-xs rounded bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustomServer}
                    disabled={!customName.trim()}
                    className={`px-2 py-1 text-xs rounded ${
                      customName.trim() 
                        ? "bg-blue-600 hover:bg-blue-700 text-white" 
                        : "bg-[#3c3c3c] text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Add Server
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Custom Server Creation Option */}
              <CommandItem
                onSelect={() => setShowCustomForm(true)}
                className="flex items-center gap-2 py-3"
              >
                <Terminal className="h-4 w-4 text-green-500" />
                <span>Create custom MPC server</span>
                <ArrowRight className="ml-auto h-4 w-4 text-gray-400" />
              </CommandItem>
              
              <CommandSeparator />
              
              {/* Active Servers section */}
              {activeServerCount > 0 && (
                <>
                  <CommandGroup heading="Active Servers">
                    {activeServerNames
                      .filter(key => key.toLowerCase().includes(search.toLowerCase()))
                      .map(serverName => (
                        <CommandItem
                          key={`active-${serverName}`}
                          className="flex items-center justify-between py-3"
                          onSelect={() => {
                            if (onRemoveServer) {
                              onRemoveServer(serverName);
                              onOpenChange(false);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {getStatusIndicator(serverName)}
                            <span>{serverName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white">
                              {getStatusText(serverName)}
                            </span>
                            {onRemoveServer && (
                              <button 
                                className="text-gray-400 hover:text-red-400 focus:outline-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveServer(serverName);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              
              {/* Available Servers section */}
              <CommandGroup heading={`Available Servers`}>
                {Object.entries(serverConfigs)
                  .filter(([key]) => 
                    !activeServers[key] && key.toLowerCase().includes(search.toLowerCase())
                  )
                  .map(([serverName]) => (
                    <CommandItem
                      key={serverName}
                      onSelect={() => {
                        onSelectServer(serverName);
                        onOpenChange(false);
                      }}
                      className="flex items-center gap-2 py-3"
                    >
                      {getStatusIndicator(serverName)}
                      <span>{serverName}</span>
                      <span 
                        className={cn(
                          "ml-auto text-xs px-2 py-0.5 rounded-full",
                          activeServerCount > 0 ? "bg-blue-400/20 text-blue-400" : "bg-gray-600 text-gray-200"
                        )}
                      >
                        {getStatusText(serverName)}
                      </span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
} 