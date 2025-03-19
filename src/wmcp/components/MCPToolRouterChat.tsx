"use client";

import React, { useRef, useEffect } from 'react';
import { ChatMessage, MatchingTool, useMpcToolRouter } from '../hooks/useMpcToolRouter';
import type { ServerConfig } from '../lib/McpClientManager';

export interface MCPToolRouterChatProps {
  className?: string;
  // Add serverConfigs as the main required prop
  serverConfigs: Record<string, ServerConfig>;
}

export function MCPToolRouterChat({
  className = '',
  serverConfigs
}: MCPToolRouterChatProps) {
  // Use the hook to manage all state
  const {
    mcpStatus,
    tools,
    indexingStatus,
    indexingStats,
    modelStatus,
    userInput,
    setUserInput,
    messages,
    isProcessing,
    matchingTools,
    isGeneratingPreview,
    handleSubmit
  } = useMpcToolRouter(serverConfigs);
  
  // For scrolling to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Determine if the chat input should be disabled
  const disabled = mcpStatus !== 'READY';
  
  // Render loading indicator based on model status
  const renderModelStatus = () => {
    // Don't show anything when ready or in fallback mode AND indexing is completed
    // Also skip showing the 'initializing worker' status
    if ((modelStatus.status === 'ready' || modelStatus.status === 'fallback') && 
        indexingStatus === 'completed' || 
        modelStatus.status === 'not-initialized' ||
        modelStatus.status === 'initializing') {
      return null;
    }
    
    let statusColor = 'bg-blue-500';
    let statusText = 'Loading...';
    
    switch (modelStatus.status) {
      case 'downloading':
        statusColor = 'bg-blue-500';
        statusText = 'Downloading model';
        break;
      case 'loading':
        statusColor = 'bg-yellow-500';
        statusText = 'Loading model';
        break;
      case 'error':
        statusColor = 'bg-red-500';
        statusText = 'Error';
        break;
      case 'fallback':
        statusColor = 'bg-green-500';
        statusText = 'Using fallback model';
        break;
      default:
        // Skip rendering for initializing states
        return null;
    }
    
    const progress = modelStatus.progress !== undefined 
      ? Math.round(modelStatus.progress * 100) 
      : indexingStatus === 'indexing' && indexingStats 
        ? Math.min(100, Math.round((indexingStats.indexedCount / (tools?.length || 1)) * 100))
        : null;
      
    return (
      <div className="mb-4 w-full">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium">{statusText}</div>
          {progress !== null && (
            <div className="text-sm font-medium">{progress}%</div>
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`${statusColor} h-2.5 rounded-full transition-all duration-300`} 
            style={{ 
              width: progress !== null ? `${progress}%` : '100%',
              animation: progress === null ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
            }}
          ></div>
        </div>
        {modelStatus.message && (
          <div className="mt-1 text-xs text-gray-500">{modelStatus.message}</div>
        )}
      </div>
    );
  };
  
  return (
    <div className={`flex flex-col h-full w-full ${className}`}>
      {/* Status header section */}
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-2">MCP Tool Router</h1>
        <div className="bg-gray-100 p-3 rounded-lg">
          <div className="flex items-center mb-2">
            <div 
              className={`h-3 w-3 rounded-full mr-2 ${
                mcpStatus === 'READY' 
                  ? 'bg-green-500' 
                  : mcpStatus === 'STARTING' || mcpStatus === 'INSTALLING_NODE_MODULES'
                  ? 'bg-yellow-500' 
                  : 'bg-red-500'
              }`}
            ></div>
            <span className="font-medium">
              MCP Status: {mcpStatus}
            </span>
          </div>
          
          <div className="text-sm">
            <p>Available Tools: {tools ? tools.length : 0}</p>
            {indexingStatus !== 'idle' && (
              <p>
                Tool Indexing: {indexingStatus} 
                {indexingStats && ` (${indexingStats.indexedCount} indexed, ${indexingStats.failedCount} failed)`}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Model loading status */}
      {renderModelStatus() && (
        <div className="px-4">
          {renderModelStatus()}
        </div>
      )}
      
      {/* Chat UI */}
      <div className="flex-1 flex flex-col border border-gray-200 rounded-lg overflow-hidden mx-4 mb-4">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md mx-auto">
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  Semantic Tool Discovery
                </h3>
                <p className="text-sm text-gray-500">
                  Describe what you're looking for and I'll find the most relevant tools based on semantic similarity.
                </p>
              </div>
            </div>
          ) : (
            messages.map(message => (
              <div 
                key={message.id}
                className={`p-3 rounded-lg max-w-3xl ${
                  message.type === 'user' 
                    ? 'bg-blue-100 ml-auto' 
                    : message.type === 'tool'
                    ? 'bg-green-100'
                    : 'bg-gray-100'
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">
                  {message.type === 'user' 
                    ? 'You' 
                    : message.type === 'tool'
                    ? `Tool: ${message.toolName}`
                    : 'System'}
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSubmit} className="border-t p-4">
          {matchingTools.length > 0 && (
            <div className="mb-3 text-sm">
              <div className="font-medium text-gray-700 mb-1">Matching Tools:</div>
              <div className="flex flex-wrap gap-1">
                {matchingTools.map(tool => (
                  <div 
                    key={tool.toolName}
                    className="bg-gray-100 text-gray-800 px-2 py-1 rounded-md flex items-center"
                  >
                    <span className="font-medium">{tool.toolName}</span>
                    <span className="ml-1 text-xs text-gray-500">
                      ({Math.round(tool.similarity * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex">
            <input
              type="text"
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder="Describe what you're looking for..."
              className="flex-1 px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing || disabled}
            />
            <button
              type="submit"
              className={`px-4 py-2 rounded-r-lg font-medium text-white ${
                isProcessing || !userInput.trim() || disabled
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
              disabled={isProcessing || !userInput.trim() || disabled}
            >
              {isProcessing ? 'Processing...' : 'Find Tools'}
            </button>
          </div>
          
          {isGeneratingPreview && (
            <div className="mt-2 text-xs text-gray-500 flex items-center">
              <svg className="animate-spin mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Finding relevant tools...
            </div>
          )}
        </form>
      </div>
      
      <div className="px-4 pb-4 text-gray-600 text-sm">
        <p>
          This component routes user messages to semantically relevant MCP tools. 
          When you type a message, it will automatically detect suitable tools, preview 
          them before submission, and activate them when your message is sent.
        </p>
      </div>
    </div>
  );
} 