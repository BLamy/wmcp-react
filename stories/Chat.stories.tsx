import React from 'react';
import { preview } from '../.storybook/preview';
import { Chat } from '../src/wmcp/components/chat';

const meta = preview.meta({
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
});

// Main story example showcasing the Chat component with default server configs
export const Example = meta.story({
  name: 'Default Chat',
  args: {},
  render: function Story(args) {
    return <Chat {...args} />;
  }
});

// Custom server configuration example
export const CustomServerConfig = meta.story({
  name: 'Custom Server Config',
  args: {
    serverConfigs: {
      'mcp-server-everything': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-everything'],
        env: {
          DEBUG: 'true'
        }
      }
    }
  },
  render: function Story(args) {
    return (
      <div>
        <Chat {...args} />
      </div>
    );
  }
});

// Default export for Storybook
export default meta; 