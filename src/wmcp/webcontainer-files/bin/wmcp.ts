#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ReadResourceResultSchema } from '@modelcontextprotocol/sdk/types.js';
import * as readline from 'readline';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';
import * as fs from 'fs';
import { z } from 'zod';

// Simple ANSI color codes for formatting output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

// Create a custom transport for direct connection between CLI and server
class CliTransport {
  onmessage: ((message: any) => void) | null;
  onclose: (() => void) | null;
  onerror: ((error: Error) => void) | null;
  isStarted: boolean;
  pendingRequests: Map<string, PendingRequest>;

  constructor() {
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.isStarted = false;
    this.pendingRequests = new Map();
  }

  async start(): Promise<void> {
    this.isStarted = true;
    return Promise.resolve();
  }

  async send(message: any): Promise<any> {
    // Send the message to the server process via stdio
    const jsonMessage = JSON.stringify(message);
    process.stdout.write(jsonMessage + '\n');
    
    if (message.id) {
      // Create a promise for the response
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          process.stderr.write(`Request timed out: ${jsonMessage}\n`);
          this.pendingRequests.delete(message.id);
          reject(new Error('Request timed out'));
        }, 10000);
        
        this.pendingRequests.set(message.id, { resolve, reject, timeout });
      });
    }
  }

  // Method to handle incoming messages from the server
  handleMessage(messageStr: string): void {
    try {
      const message = JSON.parse(messageStr);
      
      // Handle responses to pending requests
      if (message.id && (message.result !== undefined || message.error !== undefined)) {
        const pendingRequest = this.pendingRequests.get(message.id);
        if (pendingRequest) {
          clearTimeout(pendingRequest.timeout);
          this.pendingRequests.delete(message.id);
          
          if (message.error) {
            pendingRequest.reject(new Error(message.error.message || 'Unknown error'));
          } else {
            pendingRequest.resolve(message.result);
          }
        }
      }
      
      // Call onmessage handler if defined
      if (this.onmessage) {
        this.onmessage(message);
      }
    } catch (error: unknown) {
      const err = error as Error;
      process.stderr.write(`Error parsing message: ${err.message}\n`);
      process.stderr.write(`Problematic message: ${messageStr}\n`);
    }
  }

  async close(): Promise<void> {
    this.isStarted = false;
    
    // Clear all pending requests
    for (const [id, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
      this.pendingRequests.delete(id);
    }
    
    if (this.onclose) {
      this.onclose();
    }
  }
}

interface McpClient {
  connect: (transport: any) => Promise<void>;
  request: (params: any, schema?: any) => Promise<any>;
  listResources: () => Promise<any>;
  listTools: () => Promise<any>;
  listPrompts: () => Promise<any>;
  readResource: (uri: string) => Promise<any>;
  callTool: (name: string, toolArgs: any) => Promise<any>;
  getPrompt: (name: string) => Promise<any>;
}

// Create empty schema for methods that require one
const EmptySchema = z.object({});

// Create an MCP client
async function createMcpClient(): Promise<McpClient> {
  // Create client with required parameters
  const client = new Client(
    { name: 'wmcp-cli', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
  
  // Fix: StdioClientTransport needs command for spawning process
  const transport = new StdioClientTransport({
    command: 'node',
    args: []
  });
  await client.connect(transport);

  // Create wrapper client that matches our McpClient interface
  const mcpClient: McpClient = {
    connect: client.connect.bind(client),
    request: client.request.bind(client),
    
    // Use empty schema object instead of null
    listResources: async () => client.request({ method: 'resources/list' }, EmptySchema),
    listTools: async () => client.request({ method: 'tools/list' }, EmptySchema),
    listPrompts: async () => client.request({ method: 'prompts/list' }, EmptySchema),
    
    readResource: async (uri: string) => {
      return client.request(
        { method: 'resources/read', params: { uri } },
        ReadResourceResultSchema
      );
    },
    
    callTool: async (name: string, toolArgs: any) => {
      return client.request(
        { 
          method: 'tools/call', 
          params: { 
            name, 
            arguments: toolArgs 
          } 
        },
        EmptySchema
      );
    },
    
    getPrompt: async (name: string) => {
      return client.request(
        { 
          method: 'prompts/get', 
          params: { name } 
        },
        EmptySchema
      );
    }
  };

  return mcpClient;
}

// Format the output for better readability
function formatOutput(data: any): string {
  if (typeof data === 'string') {
    return data;
  }
  
  return JSON.stringify(data, null, 2);
}

type CommandHandler = (client: McpClient, args: string[]) => Promise<void>;

// Define command handlers
const commands: Record<string, CommandHandler> = {
  help: async (client: McpClient, args: string[]): Promise<void> => {
    console.log(`
${colors.bright}${colors.cyan}wmcp CLI Tool${colors.reset} - WebContainer MCP CLI

${colors.bright}Available commands:${colors.reset}
  ${colors.green}help${colors.reset}                  Show this help message
  ${colors.green}list${colors.reset}                  List all available resources
  ${colors.green}tools${colors.reset}                 List all available tools
  ${colors.green}prompts${colors.reset}               List all available prompts
  ${colors.green}read <uri>${colors.reset}            Read a resource by URI
  ${colors.green}tool <name> [args]${colors.reset}    Call a tool with arguments (in JSON format)
  ${colors.green}prompt <name>${colors.reset}         Get a prompt by name
  ${colors.green}exit${colors.reset}                  Exit the CLI

${colors.bright}Examples:${colors.reset}
  ${colors.dim}wmcp list${colors.reset}
  ${colors.dim}wmcp read note://1${colors.reset}
  ${colors.dim}wmcp tool create_note {"title":"Test","content":"Content"}${colors.reset}
  ${colors.dim}wmcp prompt summarize_notes${colors.reset}
    `);
  },
  
  list: async (client: McpClient, args: string[]): Promise<void> => {
    const response = await client.listResources();
    console.log(`${colors.bright}${colors.cyan}Available Resources:${colors.reset}`);
    
    if (response && response.resources && response.resources.length > 0) {
      response.resources.forEach((resource: any) => {
        console.log(`  ${colors.green}${resource.name}${colors.reset} - ${resource.uri}`);
      });
    } else {
      console.log(`  ${colors.dim}No resources found${colors.reset}`);
    }
  },
  
  tools: async (client: McpClient, args: string[]): Promise<void> => {
    const response = await client.listTools();
    console.log(`${colors.bright}${colors.cyan}Available Tools:${colors.reset}`);
    
    if (response && response.tools && response.tools.length > 0) {
      response.tools.forEach((tool: any) => {
        console.log(`  ${colors.green}${tool.name}${colors.reset} - ${tool.description || 'No description'}`);
      });
    } else {
      console.log(`  ${colors.dim}No tools found${colors.reset}`);
    }
  },
  
  prompts: async (client: McpClient, args: string[]): Promise<void> => {
    const response = await client.listPrompts();
    console.log(`${colors.bright}${colors.cyan}Available Prompts:${colors.reset}`);
    
    if (response && response.prompts && response.prompts.length > 0) {
      response.prompts.forEach((prompt: any) => {
        console.log(`  ${colors.green}${prompt.name}${colors.reset} - ${prompt.description || 'No description'}`);
      });
    } else {
      console.log(`  ${colors.dim}No prompts found${colors.reset}`);
    }
  },
  
  read: async (client: McpClient, args: string[]): Promise<void> => {
    if (!args[0]) {
      console.error(`${colors.red}Error:${colors.reset} URI is required`);
      return;
    }
    
    try {
      const response = await client.readResource(args[0]);
      console.log(`${colors.bright}${colors.cyan}Resource Content:${colors.reset}`);
      
      if (response && response.contents && response.contents.length > 0) {
        response.contents.forEach((content: any, index: number) => {
          if (content.text) {
            console.log(`${colors.green}Content ${index + 1}:${colors.reset} ${content.text}`);
          } else {
            console.log(`${colors.green}Content ${index + 1}:${colors.reset} ${formatOutput(content)}`);
          }
        });
      } else {
        console.log(`  ${colors.dim}Empty resource${colors.reset}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
    }
  },
  
  tool: async (client: McpClient, args: string[]): Promise<void> => {
    if (!args[0]) {
      console.error(`${colors.red}Error:${colors.reset} Tool name is required`);
      return;
    }
    
    const toolName = args[0];
    let toolArgs = {};
    
    if (args[1]) {
      try {
        toolArgs = JSON.parse(args[1]);
      } catch (error: unknown) {
        const err = error as Error;
        console.error(`${colors.red}Error:${colors.reset} Invalid JSON arguments: ${err.message}`);
        return;
      }
    }
    
    try {
      const response = await client.callTool(toolName, toolArgs);
      console.log(`${colors.bright}${colors.cyan}Tool Result:${colors.reset}`);
      console.log(formatOutput(response));
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
    }
  },
  
  prompt: async (client: McpClient, args: string[]): Promise<void> => {
    if (!args[0]) {
      console.error(`${colors.red}Error:${colors.reset} Prompt name is required`);
      return;
    }
    
    try {
      const response = await client.getPrompt(args[0]);
      console.log(`${colors.bright}${colors.cyan}Prompt:${colors.reset}`);
      console.log(formatOutput(response));
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
    }
  }
};

// Implement tab completion for commands and arguments
async function setupTabCompletion(client: McpClient, rl: readline.Interface): Promise<void> {
  // Get resources, tools, and prompts for autocomplete
  let resources: string[] = [];
  let tools: string[] = [];
  let prompts: string[] = [];
  
  try {
    const resourcesResponse = await client.listResources();
    if (resourcesResponse && resourcesResponse.resources) {
      resources = resourcesResponse.resources.map((r: any) => r.uri);
    }
    
    const toolsResponse = await client.listTools();
    if (toolsResponse && toolsResponse.tools) {
      tools = toolsResponse.tools.map((t: any) => t.name);
    }
    
    const promptsResponse = await client.listPrompts();
    if (promptsResponse && promptsResponse.prompts) {
      prompts = promptsResponse.prompts.map((p: any) => p.name);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`${colors.red}Error loading autocomplete data:${colors.reset} ${err.message}`);
  }
  
  // Add completer as a property to the readline interface (compatible way)
  (rl as any).completer = function(line: string): [string[], string] {
    const args = line.split(' ');
    const command = args[0];
    
    // Complete command names
    if (args.length === 1) {
      const completions = Object.keys(commands).filter(cmd => cmd.startsWith(command));
      return [completions.length > 0 ? completions.map(c => c + ' ') : [], command];
    }
    
    // Complete arguments based on command
    if (args.length === 2) {
      const partialArg = args[1];
      
      if (command === 'read') {
        const matches = resources.filter(r => r.startsWith(partialArg));
        return [matches.length > 0 ? matches.map(m => `read ${m}`) : [], line];
      }
      
      if (command === 'tool') {
        const matches = tools.filter(t => t.startsWith(partialArg));
        return [matches.length > 0 ? matches.map(m => `tool ${m} `) : [], line];
      }
      
      if (command === 'prompt') {
        const matches = prompts.filter(p => p.startsWith(partialArg));
        return [matches.length > 0 ? matches.map(m => `prompt ${m}`) : [], line];
      }
    }
    
    return [[], line];
  };
}

// Main function
async function main(): Promise<void> {
  try {
    console.log(`${colors.bright}${colors.cyan}WebContainer MCP CLI${colors.reset}`);
    console.log(`Connecting to MCP server...`);
    
    const client = await createMcpClient();
    
    console.log(`${colors.green}Connected!${colors.reset} Type 'help' for available commands.`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.bright}${colors.blue}wmcp>${colors.reset} `,
      completer: (line: string): [string[], string] => {
        // Default completer before setup is complete
        const completions = Object.keys(commands);
        const hits = completions.filter((c) => c.startsWith(line));
        return [hits.length ? hits : completions, line];
      }
    });
    
    // Set up tab completion
    await setupTabCompletion(client, rl);
    
    rl.prompt();
    
    rl.on('line', async (line: string) => {
      line = line.trim();
      if (!line) {
        rl.prompt();
        return;
      }
      
      const args = line.split(' ');
      const command = args.shift()!.toLowerCase();
      
      // Handle exit command
      if (command === 'exit' || command === 'quit') {
        rl.close();
        return;
      }
      
      // Execute command
      if (command in commands) {
        try {
          await commands[command](client, args);
        } catch (error: unknown) {
          const err = error as Error;
          console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
        }
      } else {
        console.error(`${colors.red}Unknown command:${colors.reset} ${command}`);
        console.log(`Type 'help' for available commands.`);
      }
      
      rl.prompt();
    }).on('close', () => {
      console.log(`${colors.green}Goodbye!${colors.reset}`);
      process.exit(0);
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
    process.exit(1);
  }
}

// Start the CLI
main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset} ${error.message}`);
  process.exit(1);
});