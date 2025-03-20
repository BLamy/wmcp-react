import type { Meta, StoryObj } from '@storybook/react';
import { WebAuthnDemo } from '../src/components/WebAuthnDemo';

const meta: Meta<typeof WebAuthnDemo> = {
  title: 'Security/WebAuthnDemo',
  component: WebAuthnDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A demonstration of WebAuthn (passkey) authentication flow with encryption/decryption capabilities.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    initialEmail: {
      control: 'text',
      description: 'Pre-populate the email field'
    }
  }
};

export default meta;
type Story = StoryObj<typeof WebAuthnDemo>;

/**
 * Default display of the WebAuthn demo component.
 */
export const Default: Story = {};

/**
 * WebAuthn demo with a pre-filled email address.
 */
export const WithPrefilledEmail: Story = {
  args: {
    initialEmail: 'user@example.com'
  }
};

/**
 * A version that simulates smaller mobile device screens.
 */
export const MobileView: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}; 