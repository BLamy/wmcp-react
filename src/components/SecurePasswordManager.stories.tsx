import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { SecurePasswordManager } from './SecurePasswordManager';
import { AuthProvider } from '../lib/AuthContext';

const withAuthProvider = (Story: React.ComponentType) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

const meta: Meta<typeof SecurePasswordManager> = {
  title: 'Security/SecurePasswordManager',
  component: SecurePasswordManager,
  decorators: [withAuthProvider],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
          # Secure Password Manager
          
          A fully encrypted password manager that uses PGlite's secure storage capabilities
          with WebAuthn (passkeys) for authentication.
          
          ## Features
          
          - Authentication with WebAuthn/Passkeys (via AuthContext)
          - End-to-end encryption of all passwords
          - Secure storage using PGlite database
          - Copy username/password to clipboard
          - Add, edit and delete password entries
          - Optional URL and notes for each entry
          
          All TEXT fields in the database are automatically encrypted using the encryption key
          from AuthContext in the PGlite database provider.
        `
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
type Story = StoryObj<typeof SecurePasswordManager>;

export const Default: Story = {
  name: 'Password Manager',
  args: {
    className: ''
  },
  parameters: {
    docs: {
      description: {
        story: `
          Full password manager demo with secure database storage.
          
          ### Features demonstrated in this story:
          - Passkey authentication via AuthContext
          - Encrypted storage in PGlite database
          - Add/edit/delete password entries
          - Copy credentials to clipboard
          - Visit website links
        `
      }
    }
  }
}; 