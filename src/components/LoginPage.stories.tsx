import type { Meta, StoryObj } from '@storybook/react';
import { LoginPage } from './LoginPage';
import { AuthProvider } from '../webauthn/AuthContext';
import React from 'react';

const meta: Meta<typeof LoginPage> = {
  title: 'Auth/LoginPage',
  component: LoginPage,
  decorators: [
    (Story) => (
      <AuthProvider>
        <Story />
      </AuthProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  }
};

export default meta;
type Story = StoryObj<typeof LoginPage>;

export const Default: Story = {}; 