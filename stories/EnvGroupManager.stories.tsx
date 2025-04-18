import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { EnvGroupManager } from '../src/components/EnvGroupManager';
import { AuthProvider } from '../src/webauthn/AuthContext';

const withAuthProvider = (Story: React.ComponentType) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

const meta: Meta<typeof EnvGroupManager> = {
  title: 'Security/EnvGroupManager',
  component: EnvGroupManager,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A secure environment variables manager with WebAuthn authentication.'
      }
    }
  },
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes to apply to the component'
    }
  }
};

export default meta;
type Story = StoryObj<typeof EnvGroupManager>;

/**
 * Default view of the environment group manager.
 */
export const Default: Story = {
  args: {
    className: ''
  }
}; 