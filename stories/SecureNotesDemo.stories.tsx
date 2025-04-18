import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SecureNotesDemo } from '../src/components/SecureNotesDemo';
import { AuthProvider } from '../src/webauthn/AuthContext';

const withAuthProvider = (Story: React.ComponentType) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

const meta: Meta<typeof SecureNotesDemo> = {
  title: 'Security/SecureNotesDemo',
  component: SecureNotesDemo,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A demonstration of WebAuthn (passkey) authentication flow with encryption/decryption capabilities.'
      }
    }
  },
  // tags: ['autodocs'],
  argTypes: {
    initialEmail: {
      control: 'text',
      description: 'Pre-populate the email field'
    }
  }
};

export default meta;
type Story = StoryObj<typeof SecureNotesDemo>;

/**
 * WebAuthn demo with a pre-filled email address.
 */
export const SecureNotes: Story = {
  args: {
    initialEmail: 'user@example.com'
  }
};
