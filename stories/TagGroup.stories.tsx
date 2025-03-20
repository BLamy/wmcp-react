import type { Meta } from '@storybook/react';
import React from 'react';
import { Tag, TagGroup } from '../src/components/aria/TagGroup';

const meta: Meta<typeof Example> = {
  component: TagGroup,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs', '!dev'],
};

export default meta;

export const Example = (args: any) => (
  <TagGroup {...args}>
    <Tag>Chocolate</Tag>
    <Tag isDisabled>Mint</Tag>
    <Tag>Strawberry</Tag>
    <Tag>Vanilla</Tag>
  </TagGroup>
);

Example.args = {
  label: 'Ice cream flavor',
  selectionMode: 'single'
};
