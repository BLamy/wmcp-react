import { Checkbox } from '../src/Checkbox';

export default {
  title: 'Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', '!dev'],
  argTypes: {},
  args: {
    isDisabled: false,
    children: 'Checkbox'
  }
};

export const Default = {
  args: {},
};
