import { Meta, StoryObj } from "@storybook/react";
import "xterm/css/xterm.css";
import Cursor from "./Cursor";

const agentMeta: Meta<typeof Cursor> = {
  title: "Cursor/Editor",
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
  args: {
    messages: [
      {
        id: "1",
        type: "assistant_message",
        content: "Hello! I'm your coding assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ],
    setMessages: () => {},
    apiKey: "dummy-key",
    testResults: {},
  },
};

type Story = StoryObj<typeof Cursor>;

export const Default: Story = {
  args: {
  },
};
export default agentMeta;
