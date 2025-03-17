import type { Meta } from '@storybook/react';
import React from 'react';
import { RangeCalendar } from '../src/RangeCalendar';

const meta: Meta<typeof RangeCalendar> = {
  component: RangeCalendar,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs', '!dev']
};

export default meta;

export const Example = (args: any) => (
  <RangeCalendar aria-label="Trip dates" {...args} />
);
