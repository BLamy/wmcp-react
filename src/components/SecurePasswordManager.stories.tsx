import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { SecurePasswordManager } from './SecurePasswordManager';

const meta: Meta<typeof SecurePasswordManager> = {
  title: 'security/SecurePasswordManager',
  component: SecurePasswordManager,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
          # Secure Password Manager
          
          A fully encrypted password manager that uses PGlite's secure storage capabilities
          with WebAuthn (passkeys) for authentication.
          
          ## Features
          
          - Authentication with WebAuthn/Passkeys
          - End-to-end encryption of all passwords
          - Secure storage using PGlite database
          - Copy username/password to clipboard
          - Add, edit and delete password entries
          - Optional URL and notes for each entry
          
          All TEXT fields in the database are automatically encrypted using the secure flag
          in the PGlite database provider.
        `
      }
    }
  },
  args: {
    initialEmail: 'user@example.com'
  }
};

export default meta;
type Story = StoryObj<typeof SecurePasswordManager>;

export const Default: Story = {
  name: 'Password Manager',
  parameters: {
    docs: {
      description: {
        story: `
          Full password manager demo with secure database storage.
          
          ### Features demonstrated in this story:
          - Passkey authentication
          - Encrypted storage in PGlite database
          - Add/edit/delete password entries
          - Copy credentials to clipboard
          - Visit website links
        `
      }
    }
  }
}; 