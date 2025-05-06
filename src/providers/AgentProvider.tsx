import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { WebContainerContext } from '@/wmcp/providers/Webcontainer';
import {
  Message,
  ContentBlock,
  ToolCall,
  ToolResult,
  ToolCallMessage,
  ToolResultMessage,
  UserTextMessage,
  AssistantTextMessage,
  AnthropicMessage,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TOOLS,
} from '@/components/WebcontainerCodeEditor/useWebContainerAgent';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { useMcp } from './McpProvider';

export type CallLLMFunction = (
  messages: AnthropicMessage[],
  systemPrompt: string,
  tools: any[],
) => Promise<any>;

interface AgentContextValue {
  messages: Message[];
  sendMessage: (m: string | ContentBlock[]) => Promise<void>;
  clearMessages: () => void;
  isLoading: boolean;
  currentError?: string;
  mcpTools: Tool[];
  mcpResources: any[]; // TBD
  mcpPrompts: any[]; // TBD
}

const AgentCtx = createContext<AgentContextValue | undefined>(undefined);

interface Props {
  children: ReactNode;
  apiKey?: string;
  onRequestApiKey?: () => void;
  systemPrompt?: string;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function AgentProvider({
  children,
  apiKey,
  onRequestApiKey,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
}: Props) {
  const { webContainer } = useContext(WebContainerContext);
  const { tools: mcpTools, resources: mcpResources, prompts: mcpPrompts, toolToServerMap, executeTool, status: mcpStatus } = useMcp();

  const [messages, setMessages] = useState<Message[]>([{
    id: generateId(),
    type: 'assistant_message',
    content: 'Hello! How can I help you today?',
    timestamp: new Date(),
  }]);
  const [loading, setLoading] = useState(false);
  const [currentError, setCurrentError] = useState<string>();
  const queueRef = useRef<(string | ContentBlock[])[]>([]);
  const processingRef = useRef(false);

  /* -------------------------------------------------------------------- */
  // Helper – format conversation for Anthropic API
  const toAnthropic = (hist: Message[]): AnthropicMessage[] =>
    hist
      .filter((m): m is UserTextMessage | AssistantTextMessage =>
        m.type === 'user_message' || m.type === 'assistant_message',
      )
      .map((m) => ({
        role: m.type === 'user_message' ? 'user' : 'assistant',
        content: m.content,
      }));

  /* -------------------------------------------------------------------- */
  // Basic vanilla fetch wrapper for Anthropic completion
  const callLLM: CallLLMFunction = async (apiMsgs, sys, tools) => {
    if (!apiKey) {
      onRequestApiKey?.();
      throw new Error('API key required');
    }
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        messages: apiMsgs,
        system: sys,
        tools,
      }),
    });
    if (!resp.ok) throw new Error(`LLM error ${resp.status}`);
    return resp.json();
  };

  /* -------------------------------------------------------------------- */
  const handleToolCall = useCallback(async (name: string, input: any): Promise<ToolResult> => {
    // If MCP tool
    if (toolToServerMap.has(name)) {
      if (mcpStatus !== 'READY') {
        return { status: 'error', error: 'MCP not ready' };
      }
      try {
        const result = await executeTool(name, input);
        return { status: 'success', message: 'ok', ...result } as ToolResult;
      } catch (e: any) {
        return { status: 'error', error: e.message };
      }
    }
    // Built-in tools omitted for brevity – return error
    return { status: 'error', error: `Unknown tool ${name}` };
  }, [toolToServerMap, executeTool, mcpStatus]);

  /* -------------------------------------------------------------------- */
  const process = useCallback(async (hist: Message[]) => {
    const apiMsgs = toAnthropic(hist);
    const allTools = [...DEFAULT_TOOLS, ...mcpTools];
    const data = await callLLM(apiMsgs, systemPrompt, allTools);

    let newHist = [...hist];

    for (const part of data.content ?? []) {
      if (part.type === 'text') {
        const msg: AssistantTextMessage = {
          id: generateId(),
          type: 'assistant_message',
          content: part.text,
          timestamp: new Date(),
        };
        newHist.push(msg);
        setMessages(h => [...h, msg]);
      } else if (part.type === 'tool_use') {
        const call: ToolCall = { id: part.id, name: part.name, arguments: part.input };
        const callMsg: ToolCallMessage = { id: generateId(), type: 'tool_call', toolCall: call, timestamp: new Date() };
        newHist.push(callMsg);
        setMessages(h => [...h, callMsg]);

        const result = await handleToolCall(call.name, call.arguments);
        const resMsg: ToolResultMessage = { id: generateId(), type: 'tool_result', toolCallId: call.id, result, timestamp: new Date() };
        newHist.push(resMsg);
        setMessages(h => [...h, resMsg]);
      }
    }
    return newHist;
  }, [callLLM, mcpTools, systemPrompt, handleToolCall]);

  /* -------------------------------------------------------------------- */
  const sendMessage = useCallback(async (input: string | ContentBlock[]) => {
    if (processingRef.current) {
      queueRef.current.push(input);
      return;
    }
    processingRef.current = true;
    setLoading(true);

    const userMsg: UserTextMessage = { id: generateId(), type: 'user_message', content: input, timestamp: new Date() };
    setMessages(h => [...h, userMsg]);

    let hist = [...messages, userMsg];
    try {
      hist = await process(hist);
    } catch (e: any) {
      setCurrentError(e.message);
    }
    setLoading(false);
    processingRef.current = false;

    if (queueRef.current.length) {
      const next = queueRef.current.shift()!;
      sendMessage(next);
    }
  }, [messages, process]);

  const clearMessages = () => setMessages([]);

  /* -------------------------------------------------------------------- */
  const ctx: AgentContextValue = {
    messages,
    sendMessage,
    clearMessages,
    isLoading: loading,
    currentError,
    mcpTools,
    mcpResources,
    mcpPrompts,
  } as unknown as AgentContextValue;

  return <AgentCtx.Provider value={ctx}>{children}</AgentCtx.Provider>;
}

export function useAgent() {
  const ctx = useContext(AgentCtx);
  if (!ctx) throw new Error('useAgent must be used inside AgentProvider');
  return ctx;
} 