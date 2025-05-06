import { useCallback, useRef, useState, useEffect } from "react";
import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import "xterm/css/xterm.css";
import Cursor from "./Cursor";
import { SecureFormProvider } from "@/components/Auth/SecureFormProvider";
import { ApiKeyForm } from "@/components/Auth/ApiKeyForm";

const agentMeta: Meta<typeof Cursor> = {
  title: "Editors/Cursor Clone",
  component: Cursor,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
          # WebContainer Agent
          
          An AI assistant that helps users interact with code in a WebContainer environment.
          
          ## Features
          
          - Chat interface for communicating with the AI assistant
          - File system operations (read, write, create, delete)
          - Terminal command execution
          - Code analysis and editing
          - Test execution and reporting
          
          The agent uses Claude 3.7 Sonnet to provide intelligent assistance with coding tasks.
        `,
      },
    },
  },
};

type Story = StoryObj<typeof Cursor>;

export const ApiKeyAsProp: Story = {
  args: {
    apiKey: "dummy-key",
  },
};

export const ApiKeyFromSecureFormProvider: Story = {
  decorators: [
    (Story) => (
        <Story />
    ),
  ],
  render: () => {
    return (
      <SecureFormProvider<{apiKey: string}>
        storageKey="anthropic_api"
        fallback={(props) => <ApiKeyForm {...props} />}
      >
        {({ values, login }) => (
          <Cursor
            apiKey={values?.apiKey}
            onRequestApiKey={login}
          />
        )}
      </SecureFormProvider>
    );
  },
};

export default agentMeta;
