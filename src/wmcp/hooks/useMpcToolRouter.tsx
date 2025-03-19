import { useState, useEffect, useRef, useCallback } from 'react';
import { useMCPServer } from './useMcpServer';
import toolEmbeddingService, { ModelProgress } from '../lib/SimpleToolEmbeddingService';
import type { ServerConfig } from '../lib/McpClientManager';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Interfaces for the hook
export interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolResult?: any;
  timestamp: Date;
}

export interface MatchingTool {
  toolName: string;
  serverName: string;
  similarity: number;
  description: string;
}

interface IndexingStats {
  indexedCount: number;
  failedCount: number;
  details?: {
    indexed: string[];
    failed: string[];
  };
}

export type ModelStatus = 'not-initialized' | 'initializing' | 'downloading' | 'loading' | 'ready' | 'error' | 'fallback';
export type IndexingStatus = 'idle' | 'indexing' | 'completed' | 'error';

export interface UseMpcToolRouterResult {
  // Server and tools state
  mcpStatus: string;
  tools: Tool[] | undefined;
  indexingStatus: IndexingStatus;
  indexingStats: IndexingStats | null;
  modelStatus: ModelProgress;
  modelReady: boolean;
  
  // Chat state
  userInput: string;
  setUserInput: (input: string) => void;
  messages: ChatMessage[];
  isProcessing: boolean;
  matchingTools: MatchingTool[];
  isGeneratingPreview: boolean;
  
  // Functions
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  executeTool: (toolName: string, args: any) => Promise<any>;
}

export function useMpcToolRouter(serverConfigs: Record<string, ServerConfig> = {}): UseMpcToolRouterResult {
  // Get MCP server status and tool execution function - call this ONCE
  const { 
    status: mcpStatus, 
    tools, 
    toolToServerMap,
    executeTool 
  } = useMCPServer({ mcpServers: serverConfigs });
  
  // Indexing and model state
  const [indexingStats, setIndexingStats] = useState<IndexingStats | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>('idle');
  const [modelStatus, setModelStatus] = useState<ModelProgress>({ 
    status: 'not-initialized',
    message: 'Initializing model' 
  });
  const [modelReady, setModelReady] = useState(false);
  
  // Chat state
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchingTools, setMatchingTools] = useState<MatchingTool[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // When MCP tools become available, index them
  useEffect(() => {
    const indexTools = async () => {
      if (mcpStatus === 'READY' && tools && tools.length > 0 && toolToServerMap) {
        setIndexingStatus('indexing');
        
        try {
          // Convert Map to object for the indexing service
          const serverMapping: Record<string, string> = {};
          toolToServerMap.forEach((server, toolName) => {
            serverMapping[toolName] = server;
          });
          
          const result = await toolEmbeddingService.indexMcpTools(tools, serverMapping);
          setIndexingStats(result);
          setIndexingStatus('completed');
        } catch (error) {
          console.error('Error indexing tools:', error);
          setIndexingStatus('error');
        }
      }
    };
    
    indexTools();
  }, [mcpStatus, tools, toolToServerMap]);
  
  // Monitor model loading status
  useEffect(() => {
    const unsubscribe = toolEmbeddingService.onModelProgressUpdate((progress) => {
      setModelStatus(progress);
      
      if (progress.status === 'ready' || progress.status === 'fallback' || progress.status === 'error') {
        setModelReady(true);
      }
    });
    
    return unsubscribe;
  }, []);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userInput.trim() || isProcessing || mcpStatus !== 'READY') {
      return;
    }
    
    const messageId = `msg-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: messageId,
      type: 'user',
      content: userInput,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    try {
      // Search for matching tools when the form is submitted
      setIsGeneratingPreview(true);
      let foundTools: MatchingTool[] = [];
      
      try {
        // Always try to find matching tools, regardless of model status
        foundTools = await toolEmbeddingService.findMatchingTools(userInput, 5, 0.5); // Lower threshold to find more matches
        console.log('Found matching tools:', foundTools);
        
        // Always display found tools, even if none match or confidence is low
        setMessages(prev => [
          ...prev, 
          {
            id: `system-${Date.now()}-tools-found`,
            type: 'system',
            content: foundTools.length === 0 
              ? `No matching tools found for your query.`
              : `Found ${foundTools.length} matching tools:\n${foundTools.map(tool => 
                  `- ${tool.toolName} (${Math.round(tool.similarity * 100)}% confidence): ${tool.description}`
                ).join('\n')}`,
            timestamp: new Date()
          }
        ]);
        
        // Update the matching tools state for display in the UI
        setMatchingTools(foundTools);
      } catch (error) {
        console.error('Error finding matching tools:', error);
        
        setMessages(prev => [
          ...prev, 
          {
            id: `error-${Date.now()}-search`,
            type: 'system',
            content: `Error finding matching tools: ${(error as Error).message || 'Unknown error'}`,
            timestamp: new Date()
          }
        ]);
      } finally {
        setIsGeneratingPreview(false);
      }
    } finally {
      setUserInput('');
      setIsProcessing(false);
    }
  };
  
  return {
    // Server and tools state
    mcpStatus,
    tools,
    indexingStatus,
    indexingStats,
    modelStatus,
    modelReady,
    
    // Chat state
    userInput,
    setUserInput,
    messages,
    isProcessing,
    matchingTools,
    isGeneratingPreview,
    
    // Functions
    handleSubmit,
    executeTool
  };
} 