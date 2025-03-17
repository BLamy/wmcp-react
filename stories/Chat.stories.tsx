import type { Meta } from '@storybook/react';
import React from 'react';
import { Chat } from '../src/wmcp/components/chat';

const meta: Meta<typeof Chat> = {
  component: Chat,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A chat interface that uses Model Context Protocol (MCP) servers running in a WebContainer to enable AI assistant functionality with tool calling capabilities.'
      }
    }
  },
  tags: ['autodocs'],
  title: 'MCP/Chat'
};

export default meta;

// Main story example showcasing the Chat component with default server configs
export const Example = () => {
  const [showNote, setShowNote] = React.useState(true);
  
  return (
    <div>
      <Chat />
      {showNote && (
        <div className="fixed bottom-2 right-2 bg-yellow-100 dark:bg-yellow-900 p-3 rounded-lg text-xs max-w-xs relative">
          <button 
            onClick={() => setShowNote(false)}
            className="absolute top-1 right-1 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
            aria-label="Close notification"
          >
            ×
          </button>
          <p className="font-semibold">Note:</p>
          <p>This chat component uses Model Context Protocol (MCP) servers running in a WebContainer.</p>
          <p className="mt-1">The server will automatically start and load available tools.</p>
        </div>
      )}
    </div>
  );
};

// Custom server configuration example
export const CustomServerConfig = () => {
  const [showNote, setShowNote] = React.useState(true);
  
  return (
    <div>
      <Chat 
        serverConfigs={{
          'mcp-server-everything': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-everything'],
            env: {
              DEBUG: 'true'
            }
          }
        }}
      />
      {showNote && (
        <div className="fixed bottom-2 right-2 bg-yellow-100 dark:bg-yellow-900 p-3 rounded-lg text-xs max-w-xs relative">
          <button 
            onClick={() => setShowNote(false)}
            className="absolute top-1 right-1 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
            aria-label="Close notification"
          >
            ×
          </button>
          <p className="font-semibold">Custom Server Config</p>
          <p>This example uses a custom server configuration with DEBUG mode enabled.</p>
        </div>
      )}
    </div>
  );
};

// Default export for Storybook
export const Default = Example; 