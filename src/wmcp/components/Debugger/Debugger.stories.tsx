import type { Meta, StoryObj } from "@storybook/react";
import WebContainerDebugger from "./index";

const meta: Meta<typeof WebContainerDebugger> = {
  title: "Debugger/WebContainerPowered",
  component: WebContainerDebugger,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof WebContainerDebugger>;

// This story relies on the WebContainer integration by default
export const Default: Story = {};

