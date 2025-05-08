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
export type Message =
  | UserTextMessage
  | AssistantTextMessage
  | ToolCallMessage
  | ToolResultMessage;

// For Anthropic API message format
export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    }
  | {
      type: "document";
      title: string;
      source: { type: "text"; media_type: string; data: string; uri?: string };
    };

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
          description:
            "The one-indexed line number to start reading from (inclusive)",
        },
        end_line_one_indexed_inclusive: {
          type: "integer",
          description:
            "The one-indexed line number to end reading at (inclusive)",
        },
        should_read_entire_file: {
          type: "boolean",
          description: "Whether to read the entire file",
        },
        explanation: {
          type: "string",
          description:
            "One sentence explanation as to why this tool is being used",
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
          description:
            "Path to list contents of, relative to the workspace root",
        },
        explanation: {
          type: "string",
          description:
            "One sentence explanation as to why this tool is being used",
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
          description:
            "One sentence explanation as to why this command needs to be run",
        },
        is_background: {
          type: "boolean",
          description: "Whether the command should be run in the background",
        },
        require_user_approval: {
          type: "boolean",
          description:
            "Whether the user must approve the command before it is executed",
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
    name: "getFailingTests",
    description:
      "Retrieves a list of identifiers for all tests that are currently failing in the project. The identifiers can be used with other tools like 'getRuntimeValuesForTest'.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "getTestStory",
    description:
      "Get the story of a specific test execution. Use this to debug a test that failed.",
    input_schema: {
      type: "object",
      properties: {
        testName: {
          type: "string",
          description: "The name of the test to inspect variables at.",
        }
      },
      required: ["testName"],
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

// For use with the useWebContainerAgent hook
export interface UseWebContainerAgentProps {
  callLLM: (
    messages: AnthropicMessage[],
    systemPrompt: string,
    tools: any[]
  ) => Promise<any>;
  systemPrompt?: string;
  tools?: any[];
  previewMode?: boolean;
  executeMcpTool?: (toolName: string, args: any) => Promise<ToolResult>;
}

// Helper function for delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to generate unique IDs
const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function useWebContainerAgent({
  callLLM,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  tools = DEFAULT_TOOLS,
  previewMode = false,
  executeMcpTool
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
      await webContainer?.fs.readFile(path, "utf-8");
      return true;
    } catch (error) {
      return false;
    }
  };

  const formatMessagesForAPI = (
    messagesToFormat: Message[]
  ): AnthropicMessage[] => {
    const formattedMessages: AnthropicMessage[] = [];
    let currentRole: "user" | "assistant" | null = null;
    let currentContent: string | ContentBlock[] = "";
    let isContentArray = false;

    // Helper to add the current message and reset
    const addMessage = () => {
      if (
        currentRole &&
        (typeof currentContent === "string"
          ? currentContent.trim()
          : currentContent.length > 0)
      ) {
        formattedMessages.push({
          role: currentRole,
          content: currentContent,
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
          content: toolCallContent,
        });

        // Reset
        currentRole = null;
        continue;
      } else if (message.type === "tool_result") {
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
          content: resultContent,
        });

        // Reset
        currentRole = null;
        continue;
      }

      const role: "user" | "assistant" =
        message.type === "user_message" ? "user" : "assistant";

      // If role changed, push previous message
      if (currentRole !== role) {
        addMessage();
        currentRole = role;
      }

      // Special case for array content (multipart messages with images)
      if (
        typeof message.content !== "string" &&
        Array.isArray(message.content)
      ) {
        // If we have an array of content blocks, just use it directly
        currentContent = message.content as ContentBlock[];
        isContentArray = true;
      } else if (!isContentArray) {
        // Only append if current content is not an array
        // For string content, concatenate with a newline if needed
        if (typeof currentContent === "string") {
          currentContent = currentContent
            ? `${currentContent}\n${message.content}`
            : message.content;
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
      setMessages((prev) => [...prev, userMessageObj]);

      // Continue the conversation with the new user message
      await continueConversation([...messages, userMessageObj]);
    } catch (error) {
      console.error("Error in processUserMessage:", error);

      // Add error message
      const errorMessage: AssistantTextMessage = {
        id: generateId(),
        type: "assistant_message",
        content: `Error: ${
          error instanceof Error ? error.message : "An unknown error occurred"
        }`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
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
        console.log(
          "LLM Request:",
          JSON.stringify(formattedMessages, null, 2),
          JSON.stringify(currentTools.current, null, 2)
        );
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
              setMessages((prev) => [...prev, assistantMessage]);
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
              setMessages((prev) => [...prev, toolCallMessage]);

              // Execute the tool and get the result
              const result = await executeToolCall(toolCall, currentMessages);

              // Create tool result message
              const toolResultMessage: ToolResultMessage = {
                id: generateId(),
                type: "tool_result",
                toolCallId: contentItem.id,
                result,
                timestamp: new Date(),
              };

              newMessages = [...newMessages, toolResultMessage];
              setMessages((prev) => [...prev, toolResultMessage]);

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
          setMessages((prev) => [...prev, assistantMessage]);
        } else if (
          response.type === "message" &&
          response.content &&
          response.role === "assistant"
        ) {
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
                setMessages((prev) => [...prev, assistantMessage]);
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
                setMessages((prev) => [...prev, toolCallMessage]);

                // Execute the tool and get the result
                const result = await executeToolCall(toolCall, currentMessages);

                // Create tool result message
                const toolResultMessage: ToolResultMessage = {
                  id: generateId(),
                  type: "tool_result",
                  toolCallId: item.id,
                  result,
                  timestamp: new Date(),
                };

                newMessages = [...newMessages, toolResultMessage];
                setMessages((prev) => [...prev, toolResultMessage]);

                // Set flag to continue the conversation
                shouldContinue = true;
              }
            }
          }
        } else if (
          response.role === "assistant" &&
          response.model &&
          response.id
        ) {
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
                setMessages((prev) => [...prev, assistantMessage]);
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
                setMessages((prev) => [...prev, toolCallMessage]);

                // Execute the tool and get the result
                const result = await executeToolCall(toolCall, currentMessages);

                // Create tool result message
                const toolResultMessage: ToolResultMessage = {
                  id: generateId(),
                  type: "tool_result",
                  toolCallId: item.id,
                  result,
                  timestamp: new Date(),
                };

                newMessages = [...newMessages, toolResultMessage];
                setMessages((prev) => [...prev, toolResultMessage]);

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

        console.log(
          "Continuing conversation after tool call with messages:",
          newMessages.length
        );
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

  // Execute a tool call with proper error handling
  const executeToolCall = async (
    toolCall: ToolCall,
    messageList: Message[]
  ): Promise<ToolResult> => {
    try {
      console.log("Executing tool:", toolCall.name, toolCall.arguments);

      // Create a map of tools by name for easy lookup
      const toolsMap = Object.fromEntries(
        currentTools.current.map(tool => [tool.name, tool])
      );

      // Check if this is an MCP tool by checking if it exists in the built-in tools list
      const isBuiltinTool = DEFAULT_TOOLS.some(t => t.name === toolCall.name);
      const isMcpTool = !isBuiltinTool && toolsMap[toolCall.name] != null;
      
      // If it's an MCP tool, use the parent component's executeMcpTool function
      if (isMcpTool) {
        console.log(`${toolCall.name} is an MCP tool, forwarding to parent component`);
        
        if (!executeMcpTool) {
          throw new Error("No executeMcpTool function provided for MCP tool");
        }
        
        return await executeMcpTool(toolCall.name, toolCall.arguments);
      }

      // Check if WebContainer is available for WebContainer tools
      if (!webContainer) {
        throw new Error("WebContainer not initialized. Please wait for it to be ready.");
      }

      // Handle WebContainer built-in tools
      switch (toolCall.name) {
        case "edit_file": {
          const { file_path, content } = toolCall.arguments;

          // Get the old content for diff view if the file exists
          let oldContent = "";
          try {
            oldContent = await webContainer.fs.readFile(file_path, "utf-8");
          } catch (error) {
            // File might not exist, which is fine for new files
            console.log(`File ${file_path} not found, will create it.`);
          }

          // Make sure the parent directory exists
          const dirPath = file_path.substring(0, file_path.lastIndexOf("/"));
          if (dirPath) {
            try {
              await webContainer.fs.mkdir(dirPath, { recursive: true });
            } catch (error) {
              // Directory might already exist, which is fine
              console.log(
                `Directory ${dirPath} already exists or couldn't be created:`,
                error
              );
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
              error: `Failed to write to file ${file_path}: ${
                error?.message || "Unknown error"
              }`,
            };
          }
        }

        case "create_file": {
          const { file_path, content } = toolCall.arguments;

          try {
            // Make sure the parent directory exists
            const dirPath = file_path.substring(0, file_path.lastIndexOf("/"));
            if (dirPath) {
              try {
                await webContainer.fs.mkdir(dirPath, { recursive: true });
              } catch (error) {
                // Directory might already exist, which is fine
                console.log(
                  `Directory ${dirPath} already exists or couldn't be created.`
                );
              }
            }

            // Check if file already exists
            let fileExists = false;
            try {
              await webContainer.fs.readFile(file_path, "utf-8");
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
              message: `File ${file_path} created successfully: ${JSON.stringify({
                content,
              })}`,
            };
          } catch (error: any) {
            console.error(`Error creating file ${file_path}:`, error);
            return {
              status: "error",
              error: `Failed to create file ${file_path}: ${
                error?.message || "Unknown error"
              }`,
            };
          }
        }

        case "delete_file": {
          const { file_path } = toolCall.arguments;

          // Get the content before deletion
          let deletedContent = "";
          try {
            deletedContent = await webContainer.fs.readFile(file_path, "utf-8");
          } catch (error) {
            throw new Error(
              `File ${file_path} does not exist or cannot be read`
            );
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
          const {
            target_file,
            start_line_one_indexed,
            end_line_one_indexed_inclusive,
            should_read_entire_file,
          } = toolCall.arguments;

          try {
            const fileContent = await webContainer.fs.readFile(
              target_file,
              "utf-8"
            );
            const fileLines = fileContent.split("\n");

            if (should_read_entire_file) {
              return {
                status: "success",
                message: `File ${target_file} read successfully: ${JSON.stringify({
                  content: fileContent,
                  lineCount: fileLines.length,
                })}`,
                content: fileContent,
                lineCount: fileLines.length,
              };
            } else {
              // Adjust for 1-indexed to 0-indexed
              const startIdx = Math.max(0, (start_line_one_indexed || 1) - 1);
              const endIdx = Math.min(
                fileLines.length - 1,
                (end_line_one_indexed_inclusive || fileLines.length) - 1
              );

              if (startIdx > endIdx) {
                throw new Error(
                  `Invalid line range: ${start_line_one_indexed} to ${end_line_one_indexed_inclusive}`
                );
              }

              const selectedLines = fileLines.slice(startIdx, endIdx + 1);

              return {
                status: "success",
                message: `File ${target_file} lines ${start_line_one_indexed} to ${end_line_one_indexed_inclusive} read successfully: ${JSON.stringify({
                  content: selectedLines.join("\n"),
                  lineRange: {
                    start: start_line_one_indexed || 1,
                    end: end_line_one_indexed_inclusive || fileLines.length,
                  },
                  totalLines: fileLines.length,
                })}`,
              };
            }
          } catch (error) {
            throw new Error(
              `File ${target_file} does not exist or cannot be read`
            );
          }
        }

        case "list_dir": {
          const { relative_workspace_path } = toolCall.arguments;
          // Normalize path: treat "." or "./" as root
          let dirPath = relative_workspace_path.trim();
          if (dirPath === "." || dirPath === "./") dirPath = "/";
          // Ensure it starts with a leading slash (WebContainer fs is always absolute)
          if (!dirPath.startsWith("/")) {
            dirPath = `/${dirPath}`;
          }
          // Ensure trailing slash for consistency
          if (!dirPath.endsWith("/")) {
            dirPath += "/";
          }

          console.log(`list_dir: listing path -> ${dirPath}`);
          
          try {
            const dirEntries = await webContainer.fs.readdir(dirPath);
            console.log(`list_dir: found ${dirEntries.length} entries in ${dirPath}`);
            
            // For each entry, determine if it's a file or directory
            const processedEntries = await Promise.all(dirEntries.map(async (entry) => {
              const fullPath = dirPath === "/" ? `/${entry}` : `${dirPath}${entry}`;
              try {
                const isDir = await isDirectory(fullPath);
                return {
                  name: entry,
                  type: isDir ? 'directory' : 'file',
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
              message: `Directory ${dirPath} listed successfully: ${JSON.stringify(processedEntries)}`,
              files: processedEntries,
              path: dirPath,
            };
          } catch (error) {
            console.error(`list_dir error for ${dirPath}:`, error);
            throw new Error(`Directory ${dirPath} does not exist or cannot be read`);
          }
        }

        case "run_terminal_cmd": {
          const { command, is_background, require_user_approval } = toolCall.arguments;

          // Split command into command and args
          const [cmd, ...args] = command.split(" ");

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
            },
          });

          process.output.pipeTo(outputStream);

          // If background, don't wait for completion
          if (is_background) {
            return {
              status: "success",
              message: `Command "${command}" started in background: ${JSON.stringify(process)}`,
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
          const { query, include_pattern, exclude_pattern, case_sensitive } =
            toolCall.arguments;

          // This is a simplified implementation
          // In a real-world scenario, you would use a proper grep tool or recursively search files

          // First, get all files recursively
          const getAllFiles = async (dir: string = "/"): Promise<string[]> => {
            const dirEntries = await webContainer.fs.readdir(dir);
            let files: string[] = [];

            for (const entry of dirEntries) {
              if (entry === "node_modules" || entry === ".git") continue;

              const fullPath = dir === "/" ? `/${entry}` : `${dir}/${entry}`;

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
            const includeRegex = new RegExp(
              include_pattern.replace(/\*/g, ".*")
            );
            searchableFiles = searchableFiles.filter((file) =>
              includeRegex.test(file)
            );
          }

          if (exclude_pattern) {
            const excludeRegex = new RegExp(
              exclude_pattern.replace(/\*/g, ".*")
            );
            searchableFiles = searchableFiles.filter(
              (file) => !excludeRegex.test(file)
            );
          }

          // Create a RegExp for the search
          const regexFlags = case_sensitive ? "g" : "gi";
          const searchRegex = new RegExp(query, regexFlags);

          // Search each file for the pattern
          const results: Array<{
            file: string;
            matches: Array<{
              line: number;
              content: string;
              matches: Array<{ text: string; index: number | undefined }>;
            }>;
          }> = [];

          for (const filePath of searchableFiles) {
            try {
              const fileContent = await webContainer.fs.readFile(
                filePath,
                "utf-8"
              );
              const fileLines = fileContent.split("\n");

              let matches: Array<{
                line: number;
                content: string;
                matches: Array<{ text: string; index: number | undefined }>;
              }> = [];

              fileLines.forEach((line, lineIndex) => {
                if (line.match(searchRegex)) {
                  matches.push({
                    line: lineIndex + 1, // Convert to 1-indexed
                    content: line,
                    matches: Array.from(line.matchAll(searchRegex)).map(
                      (match) => ({
                        text: match[0],
                        index: match.index,
                      })
                    ),
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
            message: `Found ${results.length} files with matches for "${query}": ${JSON.stringify(results)}`,
            query,
            results,
          };
        }

        case "file_search": {
          const { query } = toolCall.arguments;

          // Get all files recursively
          const getAllFiles = async (dir: string = "/"): Promise<string[]> => {
            const dirEntries = await webContainer.fs.readdir(dir);
            let files: string[] = [];

            for (const entry of dirEntries) {
              if (entry === "node_modules" || entry === ".git") continue;

              const fullPath = dir === "/" ? `/${entry}` : `${dir}/${entry}`;

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
          const matchingFiles = allFiles.filter((filePath) => {
            return filePath.toLowerCase().includes(query.toLowerCase());
          });

          return {
            status: "success",
            message: `Found ${matchingFiles.length} files matching "${query}": ${JSON.stringify(matchingFiles)}`,
            query,
            files: matchingFiles,
          };
        }

        case "getFailingTests": {
          try {
            // First try to load Vitest coverage summary if it exists
            const coveragePath = "/.blamy/coverage/vitest-coverage.json";
            let failing: string[] = [];
            try {
              const covRaw = await webContainer.fs.readFile(coveragePath, "utf-8");
              const covJson = JSON.parse(covRaw);
              if (Array.isArray(covJson.testResults)) {
                covJson.testResults.forEach((suite: any) => {
                  if (suite && Array.isArray(suite.assertionResults)) {
                    suite.assertionResults.forEach((assert: any) => {
                      if (assert.status === "failed") {
                        failing.push(assert.title);
                      }
                    });
                  }
                });
              }
            } catch (covErr) {
              // Coverage file may not exist; log for debugging but don't treat as fatal
              console.warn("getFailingTests: unable to read coverage file", coveragePath, covErr);
            }

            // If still nothing found, fall back to heuristic using cached debug steps
            if (failing.length === 0) {
              if (!testResults.current || Object.keys(testResults.current).length === 0) {
                return {
                  status: "error",
                  error: "No test results available, and coverage summary file not found. Run tests to generate debug data or coverage file."
                };
              }

              console.log("getFailingTests: falling back to debug steps heuristic");
              Object.entries(testResults.current as Record<string, any[]>).forEach(([testId, steps]) => {
                if (!Array.isArray(steps)) return;
                for (const step of steps) {
                  if (step?.failed || step?.error) {
                    failing.push(testId);
                    break;
                  }
                }
              });
            }

            return {
              status: "success",
              message: `Retrieved ${failing.length} failing test(s): ${JSON.stringify(failing)}`,
              tests: failing
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              status: "error",
              error: `Failed to retrieve failing tests: ${msg}`
            };
          }
        }

        case "getTestStory": {
          const { testName } = toolCall.arguments;

          if (!testName) {
            return {
              status: "error",
              error: "Missing required parameter: testName",
            };
          }
          const storyDirectory = `./.timetravel/${testName.replace(/[\s\\/?:*|"<>.]/g, "_").replace(/_+/g, "_")}`;
          const storyFiles = await webContainer.fs.readdir(storyDirectory);

            // Read all story files and parse them
            const steps = [];
            for (const file of storyFiles) {
              if (file.endsWith('.json')) {
                try {
                  const filePath = `${storyDirectory}/${file}`;
                  const content = await webContainer.fs.readFile(filePath, 'utf-8');
                  const storyStep = JSON.parse(content);
                  steps.push(storyStep);
                } catch (readErr) {
                  console.error(`Failed to read or parse story file ${file}:`, readErr);
                }
              }
            }
            
            // Sort steps by stepNumber
            steps.sort((a, b) => {
              const stepA = a.stepNumber !== undefined ? a.stepNumber : 0;
              const stepB = b.stepNumber !== undefined ? b.stepNumber : 0;
              return stepA - stepB;
            });
          
          const fileNames = steps.map((step) => step.file.split("/").pop());
          const fileContents = await Promise.all(fileNames.map(async (fileName) => {
            const content = await webContainer.fs.readFile(fileName, 'utf-8');
            return { fileName, content };
          }));

          
          return {
            status: "success",
            message: `Retrieved ${steps.length} runtime value(s) for test '${testName}':
            ${fileContents.map((file) => {
              return "```"+file.fileName+"\n"+file.content+"\n```\n"
            }).join("\n")}
            
            Test Steps:
            \`\`\`json
            ${JSON.stringify(steps, null, 2)}
            \`\`\`
            `,
            values: steps,
          };
        }

        default:
          throw new Error(`Unknown tool: ${toolCall.name}`);
      }
    } catch (error) {
      console.error("Tool execution error:", error);
      return {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
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
        const serializedMessages = messages.map((msg) => ({
          ...msg,
          timestamp: msg.timestamp.toISOString(),
        }));
        localStorage.setItem(
          "webcontainerAgentMessages",
          JSON.stringify(serializedMessages)
        );
      } catch (error) {
        console.error("Error saving messages to localStorage:", error);
      }
    }
  }, [messages]);

  // Effect to restore messages from localStorage on initial load
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem("webcontainerAgentMessages");
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
      console.error("Error loading messages from localStorage:", error);
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
    updateTools,
  };
}
