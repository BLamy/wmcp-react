import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Todo, TodoItem } from '../src/components/Todo';
import { userEvent, within } from '@storybook/testing-library';

const meta: Meta<typeof Todo> = {
  title: 'Components/Todo',
  component: Todo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    initialTodos: { control: 'object' },
    onTodoChange: { action: 'onTodoChange' },
    onTodoAdd: { action: 'onTodoAdd' },
    onTodoDelete: { action: 'onTodoDelete' },
    onTodoToggle: { action: 'onTodoToggle' },
  },
};

export default meta;
type Story = StoryObj<typeof Todo>;

// Sample todos for stories
const sampleTodos: TodoItem[] = [
  { id: 1, text: 'Learn React', completed: false },
  { id: 2, text: 'Build a todo app', completed: true },
  { id: 3, text: 'Master TypeScript', completed: false },
];

// Empty todo list
export const Empty: Story = {
  args: {
    initialTodos: [],
  },
};

// With initial todos
export const WithTodos: Story = {
  args: {
    initialTodos: sampleTodos,
  },
};

// Interaction example: Adding a new todo
export const AddTodo: Story = {
  args: {
    initialTodos: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Find the input and type a new todo
    const input = canvas.getByPlaceholderText('Add a new todo...');
    await userEvent.type(input, 'Write documentation');
    
    // Click the add button
    const addButton = canvas.getByText('Add');
    await userEvent.click(addButton);
    
    // Verify the todo was added
    canvas.getByText('Write documentation');
  },
};

// Interaction example: Toggling a todo
export const ToggleTodo: Story = {
  args: {
    initialTodos: sampleTodos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Find the checkbox for "Learn React" and click it
    const todoItems = canvas.getAllByRole('listitem');
    const learnReactItem = todoItems.find(item => 
      within(item).queryByText('Learn React') !== null
    );
    
    if (learnReactItem) {
      const checkbox = within(learnReactItem).getByRole('checkbox');
      await userEvent.click(checkbox);
    }
  },
};

// Interaction example: Filtering todos
export const FilterTodos: Story = {
  args: {
    initialTodos: sampleTodos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Click the "Completed" filter button
    const completedFilterButton = canvas.getByText('Completed');
    await userEvent.click(completedFilterButton);
    
    // Wait a bit and then click the "Active" filter
    await new Promise(resolve => setTimeout(resolve, 1000));
    const activeFilterButton = canvas.getByText('Active');
    await userEvent.click(activeFilterButton);
    
    // Finally show all todos again
    await new Promise(resolve => setTimeout(resolve, 1000));
    const allFilterButton = canvas.getByText('All');
    await userEvent.click(allFilterButton);
  },
}; 