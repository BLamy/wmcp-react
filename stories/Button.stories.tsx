import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../src/Button';

const meta = {
  title: 'Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', '!dev'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'destructive']
    }
  },
  args: {
    isDisabled: false,
    children: 'Button'
  }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button'
  }
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button'
  }
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete'
  }
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    children: 'Disabled Button'
  }
};
