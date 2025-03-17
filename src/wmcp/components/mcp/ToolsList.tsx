import React from 'react';

export interface Tool {
  name: string;
  description: string;
  [key: string]: any;
}

export interface ToolsListProps {
  /** Array of tools to display */
  tools: Tool[];
  /** Handler for tool selection */
  onSelectTool?: (tool: Tool) => void;
  /** Currently selected tool */
  selectedTool?: Tool | null;
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Optional loading message */
  loadingMessage?: string;
  /** Optional empty message */
  emptyMessage?: string;
  /** Optional additional CSS class names */
  className?: string;
  /** Max height for the list container */
  maxHeight?: string;
}

/**
 * A reusable component for displaying MCP tools
 */
export function ToolsList({
  tools,
  onSelectTool,
  selectedTool,
  isLoading = false,
  loadingMessage = 'Loading tools...',
  emptyMessage = 'No tools available',
  className = '',
  maxHeight = '60vh'
}: ToolsListProps) {
  return (
    <div className={`border rounded-md overflow-hidden ${className}`}>
      <div className="bg-gray-100 px-4 py-2 font-medium border-b">
        Available Tools
      </div>
      <div className={`p-2 overflow-y-auto`} style={{ maxHeight }}>
        {isLoading ? (
          <div className="p-3 text-gray-500">{loadingMessage}</div>
        ) : tools.length === 0 ? (
          <div className="p-3 text-gray-500">{emptyMessage}</div>
        ) : (
          <ul className="divide-y">
            {tools.map(tool => (
              <li 
                key={tool.name}
                className={`p-2 ${onSelectTool ? 'cursor-pointer hover:bg-gray-100' : ''} ${
                  selectedTool?.name === tool.name ? 'bg-blue-50' : ''
                }`}
                onClick={() => onSelectTool && onSelectTool(tool)}
              >
                <div className="font-medium">{tool.name}</div>
                <div className="text-sm text-gray-600">{tool.description}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 