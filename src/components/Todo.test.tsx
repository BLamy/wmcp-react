import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Todo, TodoItem } from './Todo';

describe('Todo Component', () => {
  const sampleTodos: TodoItem[] = [
    { id: 1, text: 'Learn React', completed: false },
    { id: 2, text: 'Build a todo app', completed: true },
  ];

  it('renders empty todo list', () => {
    render(<Todo />);
    
    expect(screen.getByText('Todo List')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a new todo...')).toBeInTheDocument();
    expect(screen.getByText('0 items left')).toBeInTheDocument();
  });

  it('renders todo list with initial todos', () => {
    render(<Todo initialTodos={sampleTodos} />);
    
    expect(screen.getByText('Learn React')).toBeInTheDocument();
    expect(screen.getByText('Build a todo app')).toBeInTheDocument();
    expect(screen.getByText('1 item left')).toBeInTheDocument();
  });

  it('adds a new todo', async () => {
    const onTodoAdd = vi.fn();
    const onTodoChange = vi.fn();
    const user = userEvent.setup();
    
    render(<Todo onTodoAdd={onTodoAdd} onTodoChange={onTodoChange} />);
    
    const input = screen.getByPlaceholderText('Add a new todo...');
    const addButton = screen.getByText('Add');
    
    // Type text and add todo
    await user.type(input, 'New Todo Item');
    await user.click(addButton);
    
    // Check if todo was added to the list
    expect(screen.getByText('New Todo Item')).toBeInTheDocument();
    
    // Check if input was cleared
    expect(input).toHaveValue('');
    
    // Check if callbacks were called
    expect(onTodoAdd).toHaveBeenCalledTimes(1);
    expect(onTodoChange).toHaveBeenCalledTimes(1);
    
    // Verify the contents of the new todo
    const newTodo = onTodoAdd.mock.calls[0][0];
    expect(newTodo.text).toBe('New Todo Item');
    expect(newTodo.completed).toBe(false);
  });

  it('does not add an empty todo', async () => {
    const onTodoAdd = vi.fn();
    const user = userEvent.setup();
    
    render(<Todo onTodoAdd={onTodoAdd} />);
    
    const addButton = screen.getByText('Add');
    await user.click(addButton);
    
    expect(onTodoAdd).not.toHaveBeenCalled();
  });

  it('toggles todo completion status', async () => {
    const onTodoToggle = vi.fn();
    const onTodoChange = vi.fn();
    const user = userEvent.setup();
    
    render(
      <Todo 
        initialTodos={sampleTodos} 
        onTodoToggle={onTodoToggle} 
        onTodoChange={onTodoChange} 
      />
    );
    
    // Get the checkbox for the first todo (Learn React - not completed)
    const checkboxes = screen.getAllByRole('checkbox');
    const learnReactCheckbox = checkboxes[0];
    
    // Toggle the todo
    await user.click(learnReactCheckbox);
    
    // Check if callbacks were called correctly
    expect(onTodoToggle).toHaveBeenCalledWith(1, true);
    expect(onTodoChange).toHaveBeenCalledTimes(1);
    
    // The item count should now be 0
    expect(screen.getByText('0 items left')).toBeInTheDocument();
  });

  it('deletes a todo', async () => {
    const onTodoDelete = vi.fn();
    const onTodoChange = vi.fn();
    const user = userEvent.setup();
    
    render(
      <Todo 
        initialTodos={sampleTodos} 
        onTodoDelete={onTodoDelete} 
        onTodoChange={onTodoChange} 
      />
    );
    
    // Get all delete buttons and click the first one (Learn React)
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    // Check if "Learn React" is no longer in the document
    expect(screen.queryByText('Learn React')).not.toBeInTheDocument();
    
    // Check if callbacks were called correctly
    expect(onTodoDelete).toHaveBeenCalledWith(1);
    expect(onTodoChange).toHaveBeenCalledTimes(1);
    
    // Only "Build a todo app" should remain, which is completed
    expect(screen.getByText('0 items left')).toBeInTheDocument();
  });

  it('filters todos correctly', async () => {
    const user = userEvent.setup();
    
    render(<Todo initialTodos={sampleTodos} />);
    
    // Initial state shows all todos
    expect(screen.getByText('Learn React')).toBeInTheDocument();
    expect(screen.getByText('Build a todo app')).toBeInTheDocument();
    
    // Filter active todos
    await user.click(screen.getByText('Active'));
    expect(screen.getByText('Learn React')).toBeInTheDocument();
    expect(screen.queryByText('Build a todo app')).not.toBeInTheDocument();
    
    // Filter completed todos
    await user.click(screen.getByText('Completed'));
    expect(screen.queryByText('Learn React')).not.toBeInTheDocument();
    expect(screen.getByText('Build a todo app')).toBeInTheDocument();
    
    // Show all todos again
    await user.click(screen.getByText('All'));
    expect(screen.getByText('Learn React')).toBeInTheDocument();
    expect(screen.getByText('Build a todo app')).toBeInTheDocument();
  });
}); 