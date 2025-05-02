import type { Meta, StoryObj } from "@storybook/react";
import WebContainerDebugger from "./index";
import React from "react";


const meta: Meta<typeof WebContainerDebugger> = {
  title: "Webcontainer/Debugger",
  component: WebContainerDebugger,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof WebContainerDebugger>;

export const Default: Story = {

};
