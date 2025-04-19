import { Client, } from '@modelcontextprotocol/sdk/client/index.js';
import { Tool, Resource, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { WebContainerStdioTransport } from './WebcontainerStdioTransport';
import { WebContainer } from '@webcontainer/api';

type ServerProcess = {
    input: WritableStream<string>;
    output?: ReadableStream<Uint8Array | string>;
    stderr?: ReadableStream<Uint8Array | string>;
    kill?: () => void;
    exit?: Promise<any>;
};
export type ServerConfig = {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
  export class MCPClientManager {
    private clients: Map<string, Client> = new Map();
    private transports: Map<string, WebContainerStdioTransport> = new Map();
    private processes: Map<string, ServerProcess> = new Map();
    public toolToServerMap: Map<string, string> = new Map();
    private resourceToServerMap: Map<string, string> = new Map();
    private serverConfigs: Map<string, ServerConfig> = new Map();
    private isInitialized: boolean = false;
    private toolsCache: Record<string, any> = {};
    private resourcesCache: Record<string, any> = {};
    private webContainer: WebContainer | null = null;
  
    constructor(webContainer: WebContainer | null) {
      this.webContainer = webContainer;
    }
  
    // Add a method to check if WebContainer is ready
    async isWebContainerReady(): Promise<boolean> {
      if (!this.webContainer) {
        console.error('WebContainer is not available');
        return false;
      }
  
      // Check if the file system is accessible
      try {
        await this.webContainer.fs.readdir('/');
        return true;
      } catch (error) {
        console.error('WebContainer filesystem is not ready:', error);
        return false;
      }
    }
  
    // Update the initialize method with better checks
    async initialize(serverConfigs: Record<string, ServerConfig>): Promise<void> {
      if (this.isInitialized) {
        console.warn('MCP Client Manager already initialized');
        return;
      }
  
      if (!this.webContainer) {
        throw new Error('WebContainer is not available');
      }
  
      try {
        // Verify WebContainer is ready before proceeding
        const isReady = await this.isWebContainerReady();
        if (!isReady) {
          throw new Error('WebContainer is not fully initialized and ready for MPC servers');
        }
        
        console.log('Initializing MCP Client Manager with WebContainer verification passed');
        
        // Store server configurations
        for (const [serverName, config] of Object.entries(serverConfigs)) {
          this.serverConfigs.set(serverName, config);
        }
        
        // Connect to each server
        const connectPromises = Object.entries(serverConfigs).map(
          async ([serverName, config]) => {
            try {
              console.log(`Attempting to connect to server ${serverName} with config:`, config);
              await this.connectToServer(serverName, config);
              return true;
            } catch (error) {
              console.error(`Failed to connect to server ${serverName}:`, error);
              return false;
            }
          }
        );
        
        // Wait for all connection attempts to complete
        const results = await Promise.all(connectPromises);
        
        // Check if at least one server connected successfully
        if (!results.some(result => result)) {
          throw new Error('Failed to connect to any MCP server');
        }
        
        // Map tools and resources
        await this.mapToolsAndResources(); 
        
        this.isInitialized = true;
        console.log('MCP Client Manager initialized successfully');
      } catch (error) {
        console.error(`Failed to initialize MCP Client Manager:`, error);
        throw error;
      }
    }
  
    // Connect to a specific MCP server
    async connectToServer(serverName: string, config: ServerConfig): Promise<void> {
      try {
        // console.log(`Connecting to MCP server: ${serverName}`);
        
        if (!this.webContainer) {
          throw new Error('WebContainer is not available');
        }
        
        // Start the server process
        const process = await startServerProcess(this.webContainer, config, serverName);
        this.processes.set(serverName, process);
        
        // Add a longer delay to allow the server to start - increased to 8 seconds
        console.log(`Waiting for server ${serverName} to start...`);
        await new Promise(resolve => setTimeout(resolve, 8000)); // 8 second delay
        
        console.log(`Attempting to connect to MCP server ${serverName}...`);
        
        // Create transport with a more descriptive error handler
        const transport = new WebContainerStdioTransport(
          process, 
          () => {
            console.log(`MCP server ${serverName} is ready`);
          },
          serverName
        );
        
        transport.onerror = (error) => {
          console.error(`Transport error for ${serverName}:`, error);
        };
        
        // Start the transport
        await transport.start();
        this.transports.set(serverName, transport);
        
        try {
          // Create MCP client with simpler capability initialization
          // Use server-compatible initialization format
          const client = new Client({
            name: `memory-client-${serverName}`,
            version: '0.0.1'  // Match expected server version
          });
          
          // Connect client to transport with timeout and retry
          console.log(`Attempting to connect client to server ${serverName}...`);
          
          let connected = false;
          let attempts = 0;
          const maxAttempts = 3;
          
          while (!connected && attempts < maxAttempts) {
            attempts++;
            try {
              // Add a small delay between connection attempts
              if (attempts > 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
              
              console.log(`Connection attempt ${attempts} for server ${serverName}`);
              
              // Register a message handler for better debugging
              transport.onmessage = (message) => {
                console.log(`Received message from server ${serverName}:`, message);
              };
              
              // Use a simplified initialization sequence
              const connectPromise = client.connect(transport as any);
              
              // Add a timeout for connection
              const connectTimeout = new Promise<void>((_, reject) => {
                setTimeout(() => reject(new Error(`Connection to ${serverName} timed out after 15 seconds`)), 15000);
              });
              
              await Promise.race([connectPromise, connectTimeout]);
              connected = true;
              
              console.log(`Successfully connected to server ${serverName} on attempt ${attempts}`);
            } catch (error) {
              console.error(`Connection attempt ${attempts} failed:`, error);
              
              // Additional logging to understand the error better
              if (error instanceof Error) {
                console.error(`Error details: ${error.message}`);
                console.error(`Error stack: ${error.stack}`);
              }
              
              if (attempts >= maxAttempts) {
                throw error;
              }
            }
          }
          
          this.clients.set(serverName, client);
        } catch (error) {
          // console.error(`Failed to connect client for ${serverName}:`, error);
          
          // Clean up the transport
          if (transport) {
            try {
              await transport.close();
            } catch (closeError) {
              console.warn(`Error closing transport for ${serverName}:`, closeError);
            }
          }
          throw error;
        }
      } catch (error) {
        console.error(`Error connecting to server ${serverName}:`, error);
        
        // Clean up resources if connection failed
        if (this.processes.has(serverName)) {
          const process = this.processes.get(serverName);
          if (process && process.kill) {
            process.kill();
          }
          this.processes.delete(serverName);
        }
        
        if (this.transports.has(serverName)) {
          const transport = this.transports.get(serverName);
          if (transport) {
            try {
              await transport.close();
            } catch (closeError) {
              console.warn(`Error closing transport for ${serverName}:`, closeError);
            }
          }
          this.transports.delete(serverName);
        }
        
        if (this.clients.has(serverName)) {
          this.clients.delete(serverName);
        }
        
        throw error;
      }
    }
  
    // Map tools and resources from all servers
    async mapToolsAndResources(): Promise<void> {
      console.log('Mapping tools and resources from all servers...');
      
      // Clear existing mappings
      this.toolToServerMap.clear();
      this.resourceToServerMap.clear();
      
      // Map tools from all servers
      for (const [serverName, client] of this.clients.entries()) {
        try {
          console.log(`Mapping tools from server ${serverName}...`);
          const response = await client.listTools();
          
          if (response && response.tools) {
            // Cache the tools response
            this.toolsCache[serverName] = response;
            
            // Map each tool to its server
            for (const tool of response.tools) {
              this.toolToServerMap.set(tool.name, serverName);
            }
          }
        } catch (error) {
          console.warn(`Error mapping tools from server ${serverName}:`, error);
        }
      }
      
      // Map resources from all servers
      for (const [serverName, client] of this.clients.entries()) {
        try {
          console.log(`Mapping resources from server ${serverName}...`);
          const response = await client.listResources();
          
          if (response && response.resources) {
            // Cache the resources response
            this.resourcesCache[serverName] = response;
            
            // Map each resource to its server
            for (const resource of response.resources) {
              this.resourceToServerMap.set(resource.uri, serverName);
            }
          }
        } catch (error) {
          console.warn(`Error mapping resources from server ${serverName}:`, error);
        }
      }
      
      console.log('Mapping complete');
    }
  
    // List all tools from all servers
    async listAllTools(): Promise<Tool[]> {
      const allTools: Tool[] = [];
      
      for (const cachedTools of Object.values(this.toolsCache)) {
        if (cachedTools && cachedTools.tools && Array.isArray(cachedTools.tools)) {
          allTools.push(...cachedTools.tools);
        }
      }
      
      return allTools;
    }
  
    // List all resources from all servers
    async listAllResources(): Promise<Resource[]> {
      const allResources: Resource[] = [];
      
      for (const cachedResources of Object.values(this.resourcesCache)) {
        if (cachedResources && cachedResources.resources && Array.isArray(cachedResources.resources)) {
          allResources.push(...cachedResources.resources);
        }
      }
      
      return allResources;
    }
  
    // Call a specific tool with arguments
    async callTool(toolName: string, args: any): Promise<any> {
      try {
        // Check if tool is registered
        if (!this.toolToServerMap.has(toolName)) {
          throw new Error(`Tool ${toolName} is not registered`);
        }
        
        const serverName = this.toolToServerMap.get(toolName)!;
        const client = this.clients.get(serverName);
        
        if (!client) {
          throw new Error(`Server ${serverName} not connected`);
        }
        
        // Format args for MCP SDK
        const formattedArgs = {
          name: toolName,
          arguments: args
        };
        
        // Call the tool on the appropriate client
        return await client.callTool(formattedArgs);
      } catch (error) {
        console.error(`Error calling tool ${toolName}:`, error);
        throw error;
      }
    }
  
    // Read a resource by URI
    async readResource(resourceUri: string): Promise<ReadResourceResult> {
      try {
        // Check if resource is registered
        if (!this.resourceToServerMap.has(resourceUri)) {
          throw new Error(`Resource ${resourceUri} is not registered`);
        }
        
        const serverName = this.resourceToServerMap.get(resourceUri)!;
        const client = this.clients.get(serverName);
        
        if (!client) {
          throw new Error(`Server ${serverName} not connected`);
        }
        
        // Read the resource
        return await client.readResource({ uri: resourceUri }) as unknown as ReadResourceResult;
      } catch (error) {
        console.error(`Error reading resource ${resourceUri}:`, error);
        throw error;
      }
    }
  
    // Disconnect from all servers
    async disconnectAll(): Promise<void> {
      // console.log('Disconnecting from all servers...');
      
      // Close all transports
      for (const [serverName, transport] of this.transports.entries()) {
        try {
          await transport.close();
          // console.log(`Closed tran`sport for server ${serverName}`);
        } catch (error) {
          console.warn(`Error closing transport for server ${serverName}:`, error);
        }
      }
      
      // Kill all processes
      for (const [serverName, process] of this.processes.entries()) {
        try {
          if (process.kill) {
            process.kill();
            // console.log(`Killed process for server ${serverName}`);
          }
        } catch (error) {
          console.warn(`Error killing process for server ${serverName}:`, error);
        }
      }
      
      // Clear all maps
      this.clients.clear();
      this.transports.clear();
      this.processes.clear();
      this.toolToServerMap.clear();
      this.resourceToServerMap.clear();
      
      this.isInitialized = false;
    }
  }



// Start a server process with the given configuration
async function startServerProcess(
    container: WebContainer,
    config: ServerConfig,
    serverName: string
  ): Promise<ServerProcess> {
    try {
      console.log(`Starting server process for ${serverName}...`);
      console.log(`Command: ${config.command} ${config.args.join(' ')}`);
      
      // Use the correct spawn method signature
      const process = await container.spawn(config.command, config.args, {
        env: config.env || {},
      });
      
      console.log(`Server process for ${serverName} started`);
      
      return {
        input: process.input,
        output: process.output,
        // @ts-expect-error 
        stderr: process.stderr,
        kill: () => {
          console.log(`Killing server process for ${serverName}...`);
          process.kill();
        },
        exit: process.exit.then((code) => {
          console.log(`Server ${serverName} process exited with code ${code}`);
          return code;
        })
      };
    } catch (error) {
      // console.error(`Failed to start server process for ${serverName}:`, error);
      throw error;
    }
  }
  