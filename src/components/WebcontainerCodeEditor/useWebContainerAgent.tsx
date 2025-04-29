"use client";

import { useState, useRef, useEffect, useCallback, useContext } from "react";
import { WebContainerContext } from "../../wmcp/providers/Webcontainer";

// Add type definition for the global mcpExecuteTool function
declare global {
  interface Window {
    mcpExecuteTool?: (name: string, args: any) => Promise<any>;
  }
}

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
  files?: string[] | { name: string; type: string; path: string }[];
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
  content: string | ContentBlock[];
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
export type ContentBlock = 
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; title: string; source: { type: "text"; media_type: string; data: string, uri?: string } };

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant_message",
      content: "Hello! I'm your coding assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const conversationInProgress = useRef(false);
  const messageQueue = useRef<(string | ContentBlock[])[]>([]);
  const testResults = useRef<any>(null);
  const currentFileRef = useRef<string | null>(null);
  
  // Add a ref to keep track of the current tools
  const currentTools = useRef(tools);
  
  // Update tools ref when tools prop changes
  useEffect(() => {
    currentTools.current = tools;
  }, [tools]);
  
  // Function to update tools after initialization
  const updateTools = (newTools: any[]) => {
    currentTools.current = newTools;
  };

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

  const formatMessagesForAPI = (messagesToFormat: Message[]): AnthropicMessage[] => {
    const formattedMessages: AnthropicMessage[] = [];
    let currentRole: "user" | "assistant" | null = null;
    let currentContent: string | ContentBlock[] = "";
    let isContentArray = false;

    // Helper to add the current message and reset
    const addMessage = () => {
      if (currentRole && (typeof currentContent === "string" ? currentContent.trim() : currentContent.length > 0)) {
        formattedMessages.push({
          role: currentRole,
          content: currentContent
        });
      }
      currentContent = "";
      isContentArray = false;
    };

    for (const message of messagesToFormat) {
      // Handle tool calls and tool results in the conversation history
      if (message.type === "tool_call") {
        // If there's a pending message, add it
        if (currentRole) {
          addMessage();
        }
        
        // Add tool call as assistant message
        const toolArgs = JSON.stringify(message.toolCall.arguments, null, 2);
        const toolCallContent = `I'll use the ${message.toolCall.name} tool.\nInput: ${toolArgs}`;
        formattedMessages.push({
          role: "assistant",
          content: toolCallContent
        });
        
        // Reset
        currentRole = null;
        continue;
      } 
      else if (message.type === "tool_result") {
        // If there's a pending message, add it
        if (currentRole) {
          addMessage();
        }
        
        // Add tool result as user message
        let resultContent = "";
        if (message.result.status === "success") {
          resultContent = `Tool ${message.toolCallId} completed successfully: ${message.result.message}`;
          
          // Include content if available
          if (message.result.content) {
            resultContent += `\nOutput: ${message.result.content}`;
          }
          
          // Include command output if available
          if (message.result.output) {
            resultContent += `\nCommand output: ${message.result.output}`;
          }
        } else {
          resultContent = `Tool ${message.toolCallId} failed: ${message.result.error}`;
        }
        
        formattedMessages.push({
          role: "user",
          content: resultContent
        });
        
        // Reset
        currentRole = null;
        continue;
      }

      const role: "user" | "assistant" = message.type === "user_message" ? "user" : "assistant";

      // If role changed, push previous message
      if (currentRole !== role) {
        addMessage();
        currentRole = role;
      }

      // Special case for array content (multipart messages with images)
      if (typeof message.content !== "string" && Array.isArray(message.content)) {
        // If we have an array of content blocks, just use it directly
        currentContent = message.content as ContentBlock[];
        isContentArray = true;
      } else if (!isContentArray) {
        // Only append if current content is not an array
        // For string content, concatenate with a newline if needed
        if (typeof currentContent === "string") {
          currentContent = currentContent ? `${currentContent}\n${message.content}` : message.content;
        }
      }
    }

    // Add the last message
    addMessage();

    return formattedMessages;
  };

  const processUserMessage = async (userMessage: string | ContentBlock[]) => {
    try {
      if (!webContainer) {
        throw new Error("WebContainer is not available");
      }

      conversationInProgress.current = true;
      
      // Create user message object
      const userMessageObj: UserTextMessage = {
        id: generateId(),
        type: "user_message",
        content: userMessage,
        timestamp: new Date(),
      };

      // Add user message to messages
      setMessages(prev => [...prev, userMessageObj]);
      
      // Continue the conversation with the new user message
      await continueConversation([...messages, userMessageObj]);
    } catch (error) {
      console.error("Error in processUserMessage:", error);
      
      // Add error message
      const errorMessage: AssistantTextMessage = {
        id: generateId(),
        type: "assistant_message",
        content: `Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      conversationInProgress.current = false;
      
      // Process next message in queue if any
      if (messageQueue.current.length > 0) {
        const nextMessage = messageQueue.current.shift();
        if (nextMessage) {
          setTimeout(() => processUserMessage(nextMessage), 100);
        }
      }
    }
  };

  // New function to handle recursive tool calls
  const continueConversation = async (currentMessages: Message[]) => {
    try {
      // Format messages for the API
      const formattedMessages = formatMessagesForAPI(currentMessages);
      
      // Call the LLM
      let response;
      try {
        console.log('LLM Request:', JSON.stringify(formattedMessages, null, 2), JSON.stringify(currentTools.current, null, 2));
        response = await callLLM(
          formattedMessages,
          systemPrompt,
          currentTools.current
        );
        console.log("LLM Response:", JSON.stringify(response, null, 2));
      } catch (error) {
        console.error("Error calling LLM:", error);
        throw error;
      }
      
      // Track if we need to continue the conversation
      let shouldContinue = false;
      let newMessages: Message[] = [...currentMessages];
      
      // Process the response
      if (response && response.content) {
        // Handle different Anthropic response formats
        if (Array.isArray(response.content)) {
          // Process array of content blocks
          for (const contentItem of response.content) {
            if (contentItem.type === "text") {
              // Handle text content
              const assistantMessage: AssistantTextMessage = {
                id: generateId(),
                type: "assistant_message",
                content: contentItem.text,
                timestamp: new Date(),
              };
              newMessages = [...newMessages, assistantMessage];
              setMessages(prev => [...prev, assistantMessage]);
            } else if (contentItem.type === "tool_use") {
              // Handle tool use
              const toolCall: ToolCall = {
                id: contentItem.id,
                name: contentItem.name,
                arguments: contentItem.input,
              };
              
              const toolCallMessage: ToolCallMessage = {
                id: generateId(),
                type: "tool_call",
                toolCall,
                timestamp: new Date(),
              };
              
              newMessages = [...newMessages, toolCallMessage];
              setMessages(prev => [...prev, toolCallMessage]);
              
              // Execute the tool and get the result
              const result = await handleToolCall(contentItem.name, contentItem.input);
              
              // Create tool result message
              const toolResultMessage: ToolResultMessage = {
                id: generateId(),
                type: "tool_result",
                toolCallId: contentItem.id,
                result,
                timestamp: new Date(),
              };
              
              newMessages = [...newMessages, toolResultMessage];
              setMessages(prev => [...prev, toolResultMessage]);
              
              // Set flag to continue the conversation
              shouldContinue = true;
            }
          }
        } else if (typeof response.content === "string") {
          // Handle simple text response
          const assistantMessage: AssistantTextMessage = {
            id: generateId(),
            type: "assistant_message",
            content: response.content,
            timestamp: new Date(),
          };
          newMessages = [...newMessages, assistantMessage];
          setMessages(prev => [...prev, assistantMessage]);
        } else if (response.type === "message" && response.content && response.role === "assistant") {
          // Handle Anthropic v1/messages format
          if (Array.isArray(response.content)) {
            for (const item of response.content) {
              if (item.type === "text") {
                const assistantMessage: AssistantTextMessage = {
                  id: generateId(),
                  type: "assistant_message",
                  content: item.text,
                  timestamp: new Date(),
                };
                newMessages = [...newMessages, assistantMessage];
                setMessages(prev => [...prev, assistantMessage]);
              } else if (item.type === "tool_use") {
                const toolCall: ToolCall = {
                  id: item.id,
                  name: item.name,
                  arguments: item.input,
                };
                
                const toolCallMessage: ToolCallMessage = {
                  id: generateId(),
                  type: "tool_call",
                  toolCall,
                  timestamp: new Date(),
                };
                
                newMessages = [...newMessages, toolCallMessage];
                setMessages(prev => [...prev, toolCallMessage]);
                
                // Execute the tool and get the result
                const result = await handleToolCall(item.name, item.input);
                
                // Create tool result message
                const toolResultMessage: ToolResultMessage = {
                  id: generateId(),
                  type: "tool_result",
                  toolCallId: item.id,
                  result,
                  timestamp: new Date(),
                };
                
                newMessages = [...newMessages, toolResultMessage];
                setMessages(prev => [...prev, toolResultMessage]);
                
                // Set flag to continue the conversation
                shouldContinue = true;
              }
            }
          }
        } else if (response.role === "assistant" && response.model && response.id) {
          // Handle Claude 3 messages API format
          const responseContent = response.content;
          
          if (Array.isArray(responseContent)) {
            for (const item of responseContent) {
              if (item.type === "text") {
                const assistantMessage: AssistantTextMessage = {
                  id: generateId(),
                  type: "assistant_message",
                  content: item.text,
                  timestamp: new Date(),
                };
                newMessages = [...newMessages, assistantMessage];
                setMessages(prev => [...prev, assistantMessage]);
              } else if (item.type === "tool_use") {
                const toolCall: ToolCall = {
                  id: item.id,
                  name: item.name,
                  arguments: item.input,
                };
                
                const toolCallMessage: ToolCallMessage = {
                  id: generateId(),
                  type: "tool_call",
                  toolCall,
                  timestamp: new Date(),
                };
                
                newMessages = [...newMessages, toolCallMessage];
                setMessages(prev => [...prev, toolCallMessage]);
                
                // Execute the tool and get the result
                const result = await handleToolCall(item.name, item.input);
                
                // Create tool result message
                const toolResultMessage: ToolResultMessage = {
                  id: generateId(),
                  type: "tool_result",
                  toolCallId: item.id,
                  result,
                  timestamp: new Date(),
                };
                
                newMessages = [...newMessages, toolResultMessage];
                setMessages(prev => [...prev, toolResultMessage]);
                
                // Set flag to continue the conversation
                shouldContinue = true;
              }
            }
          }
        }
      }
      
      // Continue the conversation with the LLM if there were tool calls
      if (shouldContinue) {
        // Add a small delay to avoid rate limits
        await delay(100);
        
        console.log("Continuing conversation after tool call with messages:", newMessages.length);
        await continueConversation(newMessages);
      }
    } catch (error) {
      console.error("Error in continueConversation:", error);
      throw error;
    }
  };

  const sendMessage = async (userMessage: string | ContentBlock[]) => {
    // If there's already a conversation in progress, queue the message
    if (conversationInProgress.current) {
      messageQueue.current.push(userMessage);
      return;
    }
    
    setIsProcessing(true);
    try {
      await processUserMessage(userMessage);
    } catch (error) {
      console.error("Error processing user message:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // The tool handling is the key difference from useSandpackAgent - it uses WebContainer APIs
  const handleToolCall = async (name: string, input: any): Promise<ToolResult> => {
    // First check if we have a proper WebContainer instance
    if (!webContainer) {
      console.error("WebContainer not initialized, cannot execute tool:", name);
      return {
        status: "error",
        error: "WebContainer not initialized. Please wait for WebContainer to load and try again."
      };
    }

    // Check if WebContainer is ready and accessible
    try {
      // Light probe to see if WebContainer proxy is still usable
      await webContainer.fs.readdir('/');
    } catch (error) {
      console.error("WebContainer proxy error, container may have been released:", error);
      return {
        status: "error",
        error: "WebContainer appears to be unavailable or has been released. Try refreshing the page and restarting your WebContainer."
      };
    }

    try {
      // Check if it's a MCP tool that needs to be executed through the MCP server
      if (window.mcpExecuteTool && typeof window.mcpExecuteTool === 'function') {
        // This is a workaround to access MCP tools - we set a global executeTool function
        // that WebContainerAgent component can set when MCP tools are available
        try {
          const mpcResult = await window.mcpExecuteTool(name, input);
          if (mpcResult) {
            console.log(`MPC tool ${name} executed successfully:`, mpcResult);
            return {
              status: "success",
              message: `MPC tool ${name} executed successfully`,
              ...mpcResult
            };
          }
        } catch (error) {
          console.error(`MPC tool execution error for ${name}:`, error);
          // If MPC tool execution fails, we'll fall back to regular tools
        }
      }

      // Regular WebContainer tools
      switch (name) {
        case "edit_file": {
          const { file_path, content } = input;
          
          // Get the old content for diff view if the file exists
          let oldContent = "";
          try {
            oldContent = await webContainer.fs.readFile(file_path, 'utf-8');
          } catch (error) {
            // File might not exist, which is fine for new files
            console.log(`File ${file_path} not found, will create it.`);
          }

          // Make sure the parent directory exists
          const dirPath = file_path.substring(0, file_path.lastIndexOf('/'));
          if (dirPath) {
            try {
              await webContainer.fs.mkdir(dirPath, { recursive: true });
            } catch (error) {
              // Directory might already exist, which is fine
              console.log(`Directory ${dirPath} already exists or couldn't be created:`, error);
            }
          }

          // Use a try-catch block specifically for the write operation
          try {
            // Update the file
            await webContainer.fs.writeFile(file_path, content);

            return {
              status: "success",
              message: `File ${file_path} updated successfully`,
              oldContent,
              newContent: content,
            };
          } catch (error: any) {
            console.error(`Error writing to file ${file_path}:`, error);
            return {
              status: "error",
              error: `Failed to write to file ${file_path}: ${error?.message || "Unknown error"}`
            };
          }
        }
        
        case "create_file": {
          const { file_path, content } = input;
          
          try {
            // Make sure the parent directory exists
            const dirPath = file_path.substring(0, file_path.lastIndexOf('/'));
            if (dirPath) {
              try {
                await webContainer.fs.mkdir(dirPath, { recursive: true });
              } catch (error) {
                // Directory might already exist, which is fine
                console.log(`Directory ${dirPath} already exists or couldn't be created.`);
              }
            }

            // Check if file already exists
            let fileExists = false;
            try {
              await webContainer.fs.readFile(file_path, 'utf-8');
              fileExists = true;
            } catch (error) {
              // File doesn't exist, which is what we want for create
            }

            if (fileExists) {
              console.log(`File ${file_path} already exists, overwriting.`);
            }

            // Create the file
            await webContainer.fs.writeFile(file_path, content);

            return {
              status: "success",
              message: `File ${file_path} created successfully`,
              content,
            };
          } catch (error: any) {
            console.error(`Error creating file ${file_path}:`, error);
            return {
              status: "error",
              error: `Failed to create file ${file_path}: ${error?.message || "Unknown error"}`
            };
          }
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
          let filteredResults = { ...testResults.current };
          
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
    currentFileRef.current = filePath;
  };

  // Method to update test results
  const updateTestResults = (results: any) => {
    testResults.current = results;
  };

  return {
    messages,
    setMessages,
    sendMessage,
    clearMessages,
    isLoading: isProcessing,
    messagesEndRef: null,
    testResults: testResults.current,
    updateTestResults,
    setCurrentFile,
    activeFile: currentFileRef.current,
    updateTools
  };
}