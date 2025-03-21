import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { MCPToolRouterChat } from '../src/wmcp/components/MCPToolRouterChat';

const meta: Meta<typeof MCPToolRouterChat> = {
  title: 'Components/MCPToolRouterChat',
  component: MCPToolRouterChat,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MCPToolRouterChat>;

// Example server configurations
const exampleServerConfigs = {
  'memory': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {}
  },
  'filesystem': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
    env: {}
  }
};

// Default story
export const Default: Story = {
  args: {
    serverConfigs: exampleServerConfigs
  }
};

// With chat sessions enabled
export const WithChatSessions: Story = {
  args: {
    serverConfigs: exampleServerConfigs,
    enableSessions: true
  }
};
