import type { Meta } from '@storybook/react';
import React from 'react';
import { Switch } from '../src/components/aria/Switch';

const meta: Meta<typeof Switch> = {
  component: Switch,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs', '!dev']
};

export default meta;

export const Example = (args: any) => <Switch {...args}>Wi-Fi</Switch>;
