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
  tags: [],
  title: 'MCP/Chat'
};

export default meta;

// Main story example showcasing the Chat component with default server configs
export const Example = () => {  
  return <Chat />
};

// Custom server configuration example
export const CustomServerConfig = () => {  
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
    </div>
  );
};

// Default export for Storybook
export const Default = Example; 