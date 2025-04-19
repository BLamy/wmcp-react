"use client";

import { useState, useRef, useEffect, useCallback, useContext } from "react";
import { WebContainerContext } from "../../wmcp/providers/Webcontainer";

// Message types - keeping these the same as in useSandpackAgent
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  status: "success" | "error";
  message?: string;
  error?: string;
  oldContent?: string;
  newContent?: string;
  content?: string;
  deletedContent?: string;
  lineCount?: number;
  lineRange?: { start: number; end: number };
  totalLines?: number;
  files?: string[];
  path?: string;
  query?: string;
  results?: any;
  command?: string;
  output?: string;
  searchTerm?: string;
  file?: string;
  changes?: any[];
  [key: string]: any;
}

// Base message interface
export interface BaseMessage {
  id: string;
  timestamp: Date;
}

// User text message
export interface UserTextMessage extends BaseMessage {
  type: "user_message";
  content: string;
}

// Assistant text message
export interface AssistantTextMessage extends BaseMessage {
  type: "assistant_message";
  content: string;
}

// Tool call message
export interface ToolCallMessage extends BaseMessage {
  type: "tool_call";
  toolCall: ToolCall;
}

// Tool result message
export interface ToolResultMessage extends BaseMessage {
  type: "tool_result";
  toolCallId: string;
  result: ToolResult;
}

// Union type for all message types
export type Message = UserTextMessage | AssistantTextMessage | ToolCallMessage | ToolResultMessage;

// For Anthropic API message format
export type AnthropicMessage = {
  role: "user" | "assistant";
  content: any;
};

export type CallLLMFunction = (
  messages: AnthropicMessage[],
  systemPrompt: string,
  tools: any[]
) => Promise<any>;

// Default tools in the format expected by Anthropic API - same tools as in useSandpackAgent
export const DEFAULT_TOOLS = [
  {
    name: "edit_file",
    description: "Edit a file in the code editor",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "The path of the file to edit",
        },
        content: {
          type: "string",
          description: "The new content of the file",
        },
      },
      required: ["file_path", "content"],
    },
  },
  {
    name: "create_file",
    description: "Create a new file in the code editor",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "The path of the file to create",
        },
        content: {
          type: "string",
          description: "The content of the new file",
        },
      },
      required: ["file_path", "content"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from the code editor",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "The path of the file to delete",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file",
    input_schema: {
      type: "object",
      properties: {
        target_file: {
          type: "string",
          description: "The path of the file to read",
        },
        start_line_one_indexed: {
          type: "integer",
          description: "The one-indexed line number to start reading from (inclusive)",
        },
        end_line_one_indexed_inclusive: {
          type: "integer",
          description: "The one-indexed line number to end reading at (inclusive)",
        },
        should_read_entire_file: {
          type: "boolean",
          description: "Whether to read the entire file",
        },
        explanation: {
          type: "string",
          description: "One sentence explanation as to why this tool is being used",
        },
      },
      required: ["target_file", "should_read_entire_file"],
    },
  },
  {
    name: "list_dir",
    description: "List the contents of a directory",
    input_schema: {
      type: "object",
      properties: {
        relative_workspace_path: {
          type: "string",
          description: "Path to list contents of, relative to the workspace root",
        },
        explanation: {
          type: "string",
          description: "One sentence explanation as to why this tool is being used",
        },
      },
      required: ["relative_workspace_path"],
    },
  },
  {
    name: "run_terminal_cmd",
    description: "Run a command in the terminal",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The terminal command to execute",
        },
        explanation: {
          type: "string",
          description: "One sentence explanation as to why this command needs to be run",
        },
        is_background: {
          type: "boolean",
          description: "Whether the command should be run in the background",
        },
        require_user_approval: {
          type: "boolean",
          description: "Whether the user must approve the command before it is executed",
        },
      },
      required: ["command"],
    },
  },
  // Including other tools from the original agent
  {
    name: "grep_search",
    description: "Search for text patterns in files",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The regex pattern to search for",
        },
        include_pattern: {
          type: "string",
          description: "Glob pattern for files to include",
        },
        exclude_pattern: {
          type: "string",
          description: "Glob pattern for files to exclude",
        },
        case_sensitive: {
          type: "boolean",
          description: "Whether the search should be case sensitive",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "file_search",
    description: "Search for files by name",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Fuzzy filename to search for",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_test_results",
    description: "Get the results of tests that have been run",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Optional file path to filter test results for a specific file",
        },
        status: {
          type: "string",
          description: "Optional filter by test status ('pass' or 'fail')",
        },
      },
      required: [],
    },
  },
];

// Default system prompt
export const DEFAULT_SYSTEM_PROMPT = `You are a powerful agentic AI coding assistant, powered by Claude 3.7 Sonnet. 

You are pair programming with a USER to solve their coding task.
The task may require creating a new codebase, modifying or debugging an existing codebase, or simply answering a question.
Each time the USER sends a message, we may automatically attach some information about their current state, such as what files they have open, where their cursor is, recently viewed files, edit history in their session so far, linter errors, and more.
This information may or may not be relevant to the coding task, it is up for you to decide.
Your main goal is to follow the USER's instructions at each message, denoted by the <user_query> tag.

<tool_calling>
You have tools at your disposal to solve the coding task. Follow these rules regarding tool calls:
1. ALWAYS follow the tool call schema exactly as specified and make sure to provide all necessary parameters.
2. The conversation may reference tools that are no longer available. NEVER call tools that are not explicitly provided.
3. **NEVER refer to tool names when speaking to the USER.** For example, instead of saying 'I need to use the edit_file tool to edit your file', just say 'I will edit your file'.
4. Only calls tools when they are necessary. If the USER's task is general or you already know the answer, just respond without calling tools.
5. Before calling each tool, first explain to the USER why you are calling it.
</tool_calling>

<making_code_changes>
When making code changes, NEVER output code to the USER, unless requested. Instead use one of the code edit tools to implement the change.
Use the code edit tools at most once per turn.
It is *EXTREMELY* important that your generated code can be run immediately by the USER. To ensure this, follow these instructions carefully:
1. Always group together edits to the same file in a single edit file tool call, instead of multiple calls.
2. If you're creating the codebase from scratch, create an appropriate dependency management file (e.g. requirements.txt) with package versions and a helpful README.
3. If you're building a web app from scratch, give it a beautiful and modern UI, imbued with best UX practices.
4. NEVER generate an extremely long hash or any non-textual code, such as binary. These are not helpful to the USER and are very expensive.
5. Unless you are appending some small easy to apply edit to a file, or creating a new file, you MUST read the the contents or section of what you're editing before editing it.
6. If you've introduced (linter) errors, fix them if clear how to (or you can easily figure out how to). Do not make uneducated guesses. And DO NOT loop more than 3 times on fixing linter errors on the same file. On the third time, you should stop and ask the user what to do next.
7. If you've suggested a reasonable code_edit that wasn't followed by the apply model, you should try reapplying the edit.
</making_code_changes>

<searching_and_reading>
You have tools to search the codebase and read files. Follow these rules regarding tool calls:
1. If available, heavily prefer the semantic search tool to grep search, file search, and list dir tools.
2. If you need to read a file, prefer to read larger sections of the file at once over multiple smaller calls.
3. If you have found a reasonable place to edit or answer, do not continue calling tools. Edit or answer from the information you have found.
</searching_and_reading>

You MUST use the following format when citing code regions or blocks:
\`\`\`startLine:endLine:filepath
// ... existing code ...
\`\`\`
This is the ONLY acceptable format for code citations. The format is \`\`\`startLine:endLine:filepath where startLine and endLine are line numbers.`;

interface UseWebContainerAgentProps {
  callLLM: CallLLMFunction;
  isLoading?: boolean;
  systemPrompt?: string;
  tools?: any[];
}

// Helper function for delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function useWebContainerAgent({
  callLLM,
  isLoading = false,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  tools = DEFAULT_TOOLS,
}: UseWebContainerAgentProps) {
  const { webContainer } = useContext(WebContainerContext);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(isLoading);
  const [messages, setMessages] = useState<Message[]>([]);
  const [testResults, setTestResults] = useState<any>({});

  const isDirectory = async (path: string): Promise<boolean> => {
    try {
      // If we can list directory contents, it's a directory
      await webContainer?.fs.readdir(path);
      return true;
    } catch (error) {
      // If readdir fails, it's not a directory
      return false;
    }
  };
  
  // For file existence:
  const fileExists = async (path: string): Promise<boolean> => {
    try {
      await webContainer?.fs.readFile(path, 'utf-8');
      return true;
    } catch (error) {
      return false;
    }
  };
  // Refs to track conversation state
  const conversationInProgress = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageQueue = useRef<string[]>([]);
  
  // Effect to process message queue
  useEffect(() => {
    const processQueue = async () => {
      if (messageQueue.current.length > 0 && !conversationInProgress.current) {
        const nextMessage = messageQueue.current.shift();
        if (nextMessage) {
          await processUserMessage(nextMessage);
        }
      }
    };
    
    processQueue();
  }, [loading, messages]);
  
  // Function to scroll to bottom of messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Effect to scroll messages into view when they change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Convert our custom message types to Anthropic API format
  const formatMessagesForAPI = (messagesToFormat: Message[]): AnthropicMessage[] => {
    const formattedMessages: AnthropicMessage[] = [];
    
    // Process all messages in sequence
    for (let i = 0; i < messagesToFormat.length; i++) {
      const msg = messagesToFormat[i];
      
      switch(msg.type) {
        case "user_message":
          formattedMessages.push({
            role: "user",
            content: msg.content
          });
          break;
          
        case "assistant_message":
          formattedMessages.push({
            role: "assistant",
            content: msg.content
          });
          break;
          
        case "tool_call":
          // Add tool call to assistant's messages
          formattedMessages.push({
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: msg.toolCall.id,
                name: msg.toolCall.name,
                input: msg.toolCall.arguments
              }
            ]
          });
          break;
          
        case "tool_result":
          // Add tool result to user's messages
          formattedMessages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: msg.toolCallId,
                content: typeof msg.result === "string" 
                  ? msg.result
                  : JSON.stringify(msg.result)
              }
            ]
          });
          break;
      }
    }
    
    return formattedMessages;
  };

  // Process a user message and handle the full conversation flow
  const processUserMessage = async (userMessage: string) => {
    try {
      if (!webContainer) {
        throw new Error("WebContainer not initialized");
      }
      
      conversationInProgress.current = true;
      
      // Add user message
      const userMessageObj: UserTextMessage = {
        id: generateId(),
        type: "user_message",
        content: userMessage,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessageObj]);
      setLoading(true);

      // Get current file content if there's an active file
      let currentFileContent = "";
      if (activeFile) {
        try {
          currentFileContent = await webContainer.fs.readFile(activeFile, 'utf-8');
        } catch (error) {
          console.error(`Error reading active file ${activeFile}:`, error);
        }
      }

      // Get list of available files
      let availableFiles: string[] = [];
      try {
        const recursiveListFiles = async (dir: string = '/'): Promise<string[]> => {
          const dirEntries = await webContainer.fs.readdir(dir);
          let files: string[] = [];
          
          for (const entry of dirEntries) {
            if (entry === 'node_modules' || entry === '.git') continue;
            
            const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
            
            try {
              // const stats = await webContainer.fs.stat();
              
              if (await isDirectory(fullPath)) {
                files = files.concat(await recursiveListFiles(fullPath));
              } else {
                files.push(fullPath);
              }
            } catch (error) {
              console.error(`Error getting stats for ${fullPath}:`, error);
            }
          }
          
          return files;
        };
        
        availableFiles = await recursiveListFiles();
      } catch (error) {
        console.error("Error listing files:", error);
      }

      // Format messages for Anthropic API
      const formattedMessages = formatMessagesForAPI(messages.concat(userMessageObj));

      // Create context about the current state
      const contextInfo = `
Current file: ${activeFile || "None"}
Available files: ${availableFiles.join(", ")}
${
  activeFile && currentFileContent
    ? `Current file content:
\`\`\`
${currentFileContent}
\`\`\``
    : ""
}
`;

      // Call LLM with the provided function
      const fullSystemPrompt = systemPrompt + "\n\n" + contextInfo;
      const data = await callLLM(formattedMessages, fullSystemPrompt, tools);

      // Extract the assistant's response
      let assistantContent = "";
      const toolCalls = [];

      // Handle different response formats
      if (data && data.content) {
        // Find text content and tool use
        for (const contentItem of data.content) {
          if ((contentItem as any).type === "text") {
            assistantContent = (contentItem as any).text || "";
          } else if ((contentItem as any).type === "tool_use") {
            const toolCall = {
              id: (contentItem as any).id || `tool-${generateId()}`,
              name: (contentItem as any).name || (contentItem as any).tool_use?.name,
              input: (contentItem as any).input || (contentItem as any).tool_use?.input || {},
            };
            toolCalls.push(toolCall);
          }
        }
      } else {
        // Fallback for unexpected response format
        assistantContent = "Received a response in an unexpected format.";
      }

      // Create the assistant message if there's text content
      if (assistantContent) {
        const assistantMessage: AssistantTextMessage = {
          id: generateId(),
          type: "assistant_message",
          content: assistantContent,
          timestamp: new Date(),
        };

        // Add the assistant message to the UI
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // Process all tool calls
      if (toolCalls.length > 0) {
        await processToolCalls(toolCalls, messages.concat(userMessageObj), fullSystemPrompt);
      }
    } catch (error) {
      console.error("Error calling LLM:", error);

      // Add error message
      const errorMessage: AssistantTextMessage = {
        id: generateId(),
        type: "assistant_message",
        content: `Error: ${
          error instanceof Error ? error.message : "Failed to get response"
        }. Please check your settings and try again.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      conversationInProgress.current = false;
      
      // Process next message in queue if any
      if (messageQueue.current.length > 0) {
        const nextMessage = messageQueue.current.shift();
        if (nextMessage) {
          await processUserMessage(nextMessage);
        }
      }
    }
  };
  
  // Helper function to process a list of tool calls
  const processToolCalls = async (
    toolCalls: Array<{id: string, name: string, input: any}>,
    previousMessages: Message[],
    fullSystemPrompt: string
  ) => {
    let updatedMessages = [...previousMessages];
    
    for (const toolCall of toolCalls) {
      // Create a tool call message
      const toolCallMessage: ToolCallMessage = {
        id: generateId(),
        type: "tool_call",
        timestamp: new Date(),
        toolCall: {
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.input,
        },
      };

      // Add the tool call message to the UI messages
      setMessages((prev) => [...prev, toolCallMessage]);
      updatedMessages = [...updatedMessages, toolCallMessage];

      try {
        // Execute the tool
        const toolResult = await handleToolCall(
          toolCall.name,
          toolCall.input
        );
        
        // Create the tool result message
        const toolResultMessage: ToolResultMessage = {
          id: generateId(),
          type: "tool_result",
          timestamp: new Date(),
          toolCallId: toolCall.id,
          result: toolResult
        };
        
        // Add the tool result message to the UI
        setMessages((prev) => [...prev, toolResultMessage]);
        updatedMessages = [...updatedMessages, toolResultMessage];
        
        // Get response after tool execution
        const formattedMessagesForAPI = formatMessagesForAPI(updatedMessages);
        const responseAfterTool = await callLLM(
          formattedMessagesForAPI,
          fullSystemPrompt,
          tools
        );
        
        // Extract response text and any new tool calls
        let responseText = "";
        const newToolCalls = [];
        
        if (responseAfterTool && responseAfterTool.content) {
          for (const item of responseAfterTool.content) {
            if ((item as any).type === "text") {
              responseText = (item as any).text || "";
            } else if ((item as any).type === "tool_use") {
              const newToolCall = {
                id: (item as any).id || `tool-${generateId()}`,
                name: (item as any).name || (item as any).tool_use?.name,
                input: (item as any).input || (item as any).tool_use?.input || {},
              };
              newToolCalls.push(newToolCall);
            }
          }
        }
        
        if (responseText) {
          // Add response message
          const responseMessage: AssistantTextMessage = {
            id: generateId(),
            type: "assistant_message",
            content: responseText,
            timestamp: new Date(),
          };
          
          setMessages((prev) => [...prev, responseMessage]);
          updatedMessages = [...updatedMessages, responseMessage];
        }
        
        // Recursively process any new tool calls
        if (newToolCalls.length > 0) {
          await processToolCalls(newToolCalls, updatedMessages, fullSystemPrompt);
        }
      } catch (error: any) {
        console.error(`Error executing tool ${toolCall.name}:`, error);

        // Create an error result
        const errorResult: ToolResult = {
          status: "error",
          error: `Failed to execute tool: ${error.message || String(error)}`,
        };
        
        // Create an error message
        const toolResultMessage: ToolResultMessage = {
          id: generateId(),
          type: "tool_result",
          timestamp: new Date(),
          toolCallId: toolCall.id,
          result: errorResult
        };
        
        // Add the error message to the UI
        setMessages((prev) => [...prev, toolResultMessage]);
        updatedMessages = [...updatedMessages, toolResultMessage];
      }
    }
  };

  const sendMessage = async (userMessage: string) => {
    // If there's already a conversation in progress, queue the message
    if (conversationInProgress.current) {
      messageQueue.current.push(userMessage);
      return;
    }
    
    await processUserMessage(userMessage);
  };

  // The tool handling is the key difference from useSandpackAgent - it uses WebContainer APIs
  const handleToolCall = async (name: string, input: any): Promise<ToolResult> => {
    if (!webContainer) {
      throw new Error("WebContainer not initialized");
    }

    try {
      switch (name) {
        case "edit_file": {
          const { file_path, content } = input;
          
          // Get the old content for diff view if the file exists
          let oldContent = "";
          try {
            oldContent = await webContainer.fs.readFile(file_path, 'utf-8');
          } catch (error) {
            // File might not exist, which is fine for new files
          }

          // Make sure the parent directory exists
          const dirPath = file_path.substring(0, file_path.lastIndexOf('/'));
          if (dirPath) {
            try {
              await webContainer.fs.mkdir(dirPath, { recursive: true });
            } catch (error) {
              // Directory might already exist, which is fine
            }
          }

          // Update the file
          await webContainer.fs.writeFile(file_path, content);

          return {
            status: "success",
            message: `File ${file_path} updated successfully`,
            oldContent,
            newContent: content,
          };
        }
        
        case "create_file": {
          const { file_path, content } = input;
          
          // Make sure the parent directory exists
          const dirPath = file_path.substring(0, file_path.lastIndexOf('/'));
          if (dirPath) {
            try {
              await webContainer.fs.mkdir(dirPath, { recursive: true });
            } catch (error) {
              // Directory might already exist, which is fine
            }
          }

          // Create the file
          await webContainer.fs.writeFile(file_path, content);

          return {
            status: "success",
            message: `File ${file_path} created successfully`,
            content,
          };
        }
        
        case "delete_file": {
          const { file_path } = input;
          
          // Get the content before deletion
          let deletedContent = "";
          try {
            deletedContent = await webContainer.fs.readFile(file_path, 'utf-8');
          } catch (error) {
            throw new Error(`File ${file_path} does not exist or cannot be read`);
          }

          // Delete the file
          await webContainer.fs.rm(file_path);

          return {
            status: "success",
            message: `File ${file_path} deleted successfully`,
            deletedContent,
          };
        }
        
        case "read_file": {
          const { target_file, start_line_one_indexed, end_line_one_indexed_inclusive, should_read_entire_file } = input;
          
          try {
            const fileContent = await webContainer.fs.readFile(target_file, 'utf-8');
            const fileLines = fileContent.split('\n');
            
            if (should_read_entire_file) {
              return {
                status: "success",
                message: `File ${target_file} read successfully`,
                content: fileContent,
                lineCount: fileLines.length,
              };
            } else {
              // Adjust for 1-indexed to 0-indexed
              const startIdx = Math.max(0, (start_line_one_indexed || 1) - 1);
              const endIdx = Math.min(fileLines.length - 1, (end_line_one_indexed_inclusive || fileLines.length) - 1);
              
              if (startIdx > endIdx) {
                throw new Error(`Invalid line range: ${start_line_one_indexed} to ${end_line_one_indexed_inclusive}`);
              }
              
              const selectedLines = fileLines.slice(startIdx, endIdx + 1);
              
              return {
                status: "success",
                message: `File ${target_file} lines ${start_line_one_indexed} to ${end_line_one_indexed_inclusive} read successfully`,
                content: selectedLines.join('\n'),
                lineRange: {
                  start: start_line_one_indexed || 1,
                  end: end_line_one_indexed_inclusive || fileLines.length,
                },
                totalLines: fileLines.length,
              };
            }
          } catch (error) {
            throw new Error(`File ${target_file} does not exist or cannot be read`);
          }
        }
        
        case "list_dir": {
          const { relative_workspace_path } = input;
          const dirPath = relative_workspace_path === '/' ? '/' : relative_workspace_path.endsWith('/') 
            ? relative_workspace_path 
            : `${relative_workspace_path}/`;
          
          try {
            const dirEntries = await webContainer.fs.readdir(dirPath.startsWith('/') ? dirPath : `/${dirPath}`);
            
            // For each entry, determine if it's a file or directory
            const processedEntries = await Promise.all(dirEntries.map(async (entry) => {
              const fullPath = dirPath === '/' ? `/${entry}` : `${dirPath}${entry}`;
              try {
                return {
                  name: entry,
                  type: await isDirectory(fullPath) ? 'directory' : 'file',
                  path: fullPath
                };
              } catch (error) {
                return {
                  name: entry,
                  type: 'unknown',
                  path: fullPath
                };
              }
            }));
            
            return {
              status: "success",
              message: `Directory ${dirPath} listed successfully`,
              files: processedEntries,
              path: dirPath,
            };
          } catch (error) {
            throw new Error(`Directory ${dirPath} does not exist or cannot be read`);
          }
        }
        
        case "run_terminal_cmd": {
          const { command, is_background, require_user_approval } = input;
          
          // Split command into command and args
          const [cmd, ...args] = command.split(' ');
          
          // Get user approval if required
          if (require_user_approval) {
            // Here you would implement a UI to get user approval
            // For now, we'll just simulate approval
            console.log(`Requiring approval for command: ${command}`);
          }
          
          // Run the command
          const process = await webContainer.spawn(cmd, args);
          
          let output = "";
          
          // Capture the output
          const outputStream = new WritableStream({
            write(data) {
              output += data;
            }
          });
          
          process.output.pipeTo(outputStream);
          
          // If background, don't wait for completion
          if (is_background) {
            return {
              status: "success",
              message: `Command "${command}" started in background`,
              command,
            };
          }
          
          // Wait for the process to complete
          const exitCode = await process.exit;
          
          if (exitCode !== 0) {
            return {
              status: "error",
              error: `Command "${command}" failed with exit code ${exitCode}`,
              command,
              output,
            };
          }
          
          return {
            status: "success",
            message: `Command "${command}" completed successfully`,
            command,
            output,
          };
        }
        
        case "grep_search": {
          const { query, include_pattern, exclude_pattern, case_sensitive } = input;
          
          // This is a simplified implementation
          // In a real-world scenario, you would use a proper grep tool or recursively search files
          
          // First, get all files recursively
          const getAllFiles = async (dir: string = '/'): Promise<string[]> => {
            const dirEntries = await webContainer.fs.readdir(dir);
            let files: string[] = [];
            
            for (const entry of dirEntries) {
              if (entry === 'node_modules' || entry === '.git') continue;
              
              const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
              
              try {
                
                if (await isDirectory(fullPath)) {
                  files = files.concat(await getAllFiles(fullPath));
                } else {
                  files.push(fullPath);
                }
              } catch (error) {
                console.error(`Error getting stats for ${fullPath}:`, error);
              }
            }
            
            return files;
          };
          
          const allFiles = await getAllFiles();
          
          // Filter files based on include/exclude patterns
          let searchableFiles = allFiles;
          
          if (include_pattern) {
            const includeRegex = new RegExp(include_pattern.replace(/\*/g, '.*'));
            searchableFiles = searchableFiles.filter(file => includeRegex.test(file));
          }
          
          if (exclude_pattern) {
            const excludeRegex = new RegExp(exclude_pattern.replace(/\*/g, '.*'));
            searchableFiles = searchableFiles.filter(file => !excludeRegex.test(file));
          }
          
          // Create a RegExp for the search
          const regexFlags = case_sensitive ? 'g' : 'gi';
          const searchRegex = new RegExp(query, regexFlags);
          
          // Search each file for the pattern
          const results: Array<{file: string, matches: Array<{line: number, content: string, matches: Array<{text: string, index: number | undefined}>}>}> = [];
          
          for (const filePath of searchableFiles) {
            try {
              const fileContent = await webContainer.fs.readFile(filePath, 'utf-8');
              const fileLines = fileContent.split('\n');
              
              let matches: Array<{line: number, content: string, matches: Array<{text: string, index: number | undefined}>}> = [];
              
              fileLines.forEach((line, lineIndex) => {
                if (line.match(searchRegex)) {
                  matches.push({
                    line: lineIndex + 1, // Convert to 1-indexed
                    content: line,
                    matches: Array.from(line.matchAll(searchRegex)).map(match => ({
                      text: match[0],
                      index: match.index,
                    })),
                  });
                }
              });
              
              if (matches.length > 0) {
                results.push({
                  file: filePath,
                  matches,
                });
              }
            } catch (error) {
              console.error(`Error searching file ${filePath}:`, error);
            }
          }
          
          return {
            status: "success",
            message: `Found ${results.length} files with matches for "${query}"`,
            query,
            results,
          };
        }
        
        case "file_search": {
          const { query } = input;
          
          // Get all files recursively
          const getAllFiles = async (dir: string = '/'): Promise<string[]> => {
            const dirEntries = await webContainer.fs.readdir(dir);
            let files: string[] = [];
            
            for (const entry of dirEntries) {
              if (entry === 'node_modules' || entry === '.git') continue;
              
              const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
              
              try {                
                if (await isDirectory(fullPath)) {
                  files = files.concat(await getAllFiles(fullPath));
                } else {
                  files.push(fullPath);
                }
              } catch (error) {
                console.error(`Error getting stats for ${fullPath}:`, error);
              }
            }
            
            return files;
          };
          
          const allFiles = await getAllFiles();
          
          // Simple fuzzy search implementation
          const matchingFiles = allFiles.filter(filePath => {
            return filePath.toLowerCase().includes(query.toLowerCase());
          });
          
          return {
            status: "success",
            message: `Found ${matchingFiles.length} files matching "${query}"`,
            query,
            files: matchingFiles,
          };
        }
        
        case "get_test_results": {
          const { file_path, status } = input;
          
          // Return the cached test results, optionally filtered by file_path and status
          let filteredResults = { ...testResults };
          
          if (file_path) {
            filteredResults = Object.keys(filteredResults)
              .filter(key => key === file_path || key.includes(file_path))
              .reduce((obj, key) => {
                obj[key] = filteredResults[key];
                return obj;
              }, {} as any);
          }
          
          if (status) {
            // This would require more complex filtering logic depending on your test result structure
            // For now, we'll just return a simple message
            return {
              status: "success",
              message: `Filtered test results for status: ${status}`,
              results: filteredResults,
            };
          }
          
          return {
            status: "success",
            message: "Test results retrieved",
            results: filteredResults,
          };
        }
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        status: "error",
        error: errorMessage,
      };
    }
  };

  const clearMessages = () => {
    setMessages([
      {
        id: "1",
        type: "assistant_message",
        content: "Hello! I'm your coding assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ]);
    
    // Clear any pending message queue
    messageQueue.current = [];
  };

  // Effect to save messages to localStorage for persistence
  useEffect(() => {
    if (messages.length > 0) {
      try {
        // Convert Date objects to strings before saving
        const serializedMessages = messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString(),
        }));
        localStorage.setItem('webcontainerAgentMessages', JSON.stringify(serializedMessages));
      } catch (error) {
        console.error('Error saving messages to localStorage:', error);
      }
    }
  }, [messages]);
  
  // Effect to restore messages from localStorage on initial load
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem('webcontainerAgentMessages');
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        // Convert string timestamps back to Date objects
        const messagesWithDates = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(messagesWithDates);
      } else {
        // Initialize with welcome message if no saved messages
        clearMessages();
      }
    } catch (error) {
      console.error('Error loading messages from localStorage:', error);
      clearMessages();
    }
  }, []);

  // Method to update active file
  const setCurrentFile = (filePath: string | null) => {
    setActiveFile(filePath);
  };

  // Method to update test results
  const updateTestResults = (results: any) => {
    setTestResults(results);
  };

  return {
    messages,
    setMessages,
    sendMessage,
    clearMessages,
    isLoading: loading,
    messagesEndRef,
    testResults,
    updateTestResults,
    setCurrentFile,
    activeFile
  };
}