import React from 'react';
import { Calendar } from '../src/Calendar';

import type { Meta } from '@storybook/react';

const meta: Meta<typeof Calendar> = {
  component: Calendar,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs', '!dev']
};

export default meta;

export const Example = (args: any) => (
  <Calendar aria-label="Event date" {...args} />
);
