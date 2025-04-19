"use client";
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  SendIcon,
  BotIcon,
  UserIcon,
  Wrench,
  ChevronDown,
  ChevronUp,
  Loader2,
  PlusIcon
} from "lucide-react";

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
  ToolResult
} from "./useWebContainerAgent";

export interface WebContainerAgentProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  apiKey: string;
  onRequestApiKey?: () => void;
  testResults?: any;
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
  testResults
}, ref) => {
  const [input, setInput] = useState("");
  const [collapsedTools, setCollapsedTools] = useState<Record<string, boolean>>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!input.trim()) return;
    if (!apiKey || apiKey === "") {
      console.log("Anthropic API key is required");
      onRequestApiKey?.();
      return;
    }

    setInput("");

    try {
      await sendMessage(input);
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
      return (
        <div className="text-sm whitespace-pre-wrap break-words overflow-hidden">
          {message.content}
        </div>
      );
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

  return (
    <div className="h-full flex flex-col w-full bg-[#1e1e1e]">
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
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
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