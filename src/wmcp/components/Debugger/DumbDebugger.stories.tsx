import type { Meta, StoryObj } from '@storybook/react';
import Debugger from './DumbDebugger';
import * as mathFixtures from './__fixtures__/math';
import * as odataFixtures from './__fixtures__/odata';
const meta: Meta<typeof Debugger> = {
  title: 'Debugger/DumbComponent',
  component: Debugger,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Debugger>;

export const Math: Story = {
  args: {
    files: mathFixtures.files,
    debugSteps: mathFixtures.debugSteps,
    testStatuses: mathFixtures.testStatuses,
  },
};


export const OData: Story = {
  args: {
    files: odataFixtures.files,
    debugSteps: odataFixtures.debugSteps,
    testStatuses: odataFixtures.testStatuses,
  },
};
