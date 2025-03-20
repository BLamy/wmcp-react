import type { Meta } from '@storybook/react';
import React from 'react';
import { ToggleButton } from '../src/components/aria/ToggleButton';

const meta: Meta<typeof ToggleButton> = {
  component: ToggleButton,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs', '!dev']
};

export default meta;

export const Example = (args: any) => <ToggleButton {...args}>Pin</ToggleButton>;
