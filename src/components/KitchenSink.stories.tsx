import type { Meta, StoryObj } from '@storybook/react';
import { KitchenSink } from './KitchenSink';
import { AuthProvider } from '../webauthn/AuthContext';
import React from 'react';

const meta: Meta<typeof KitchenSink> = {
  title: 'Pages/KitchenSink',
  component: KitchenSink,
  decorators: [
    (Story) => (
      <AuthProvider>
        <Story />
      </AuthProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A comprehensive demo page showcasing various features including chat, MCP servers, environment variables, database explorer, and authentication.'
      }
    }
  },
  argTypes: {
    initialPage: {
      control: 'select',
      options: ['chat', 'mcp_manage', 'env_manage', 'db_explorer', 'model_config', 'auth'],
      description: 'The initial page to display'
    }
  }
};

export default meta;
type Story = StoryObj<typeof KitchenSink>;

/**
 * Default view showing the chat page with authenticated user
 */
export const Default: Story = {
  args: {
    initialPage: 'chat'
  }
};

/**
 * MCP Server Management view with authenticated user
 */
export const MCPManageView: Story = {
  args: {
    initialPage: 'mcp_manage'
  }
};

/**
 * Environment Variables Management view with authenticated user
 */
export const EnvManageView: Story = {
  args: {
    initialPage: 'env_manage'
  }
};

/**
 * Database Explorer view with authenticated user
 */
export const DBExplorerView: Story = {
  args: {
    initialPage: 'db_explorer'
  }
};

/**
 * Model Configuration view with authenticated user
 */
export const ModelConfigView: Story = {
  args: {
    initialPage: 'model_config'
  }
};

/**
 * Authentication view showing login page for unauthenticated user
 */
export const AuthView: Story = {
  args: {
    initialPage: 'auth'
  },
}; 