import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { EnvGroupManager } from './EnvGroupManager';

const meta: Meta<typeof EnvGroupManager> = {
  title: 'security/EnvGroupManager',
  component: EnvGroupManager,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
          # Environment Group Manager
          
          A secure environment variables manager that uses PGlite's secure storage capabilities
          for managing environment groups and variables.
          
          ## Features
          
          - Two-level hierarchy: Environment Groups and Environment Variables
          - End-to-end encryption of all environment variables
          - Secure storage using PGlite database
          - Copy environment variable values to clipboard
          - Add, edit and delete environment groups and variables
          
          All TEXT fields in the database are automatically encrypted using the secure flag
          in the PGlite database provider.
        `
      }
    }
  },
  args: {}
};

export default meta;
type Story = StoryObj<typeof EnvGroupManager>;

export const Default: Story = {
  name: 'Environment Manager',
  parameters: {
    docs: {
      description: {
        story: `
          Full environment group manager demo with secure database storage.
          
          ### Features demonstrated in this story:
          - Environment group management (create, edit, delete)
          - Environment variables within groups
          - Encrypted storage in PGlite database
          - Add/edit/delete variables
          - Copy environment variable values to clipboard
        `
      }
    }
  }
}; 