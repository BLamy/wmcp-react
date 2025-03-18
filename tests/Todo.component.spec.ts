import { test, expect } from '@playwright/test';

test.describe('Todo Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Storybook page for the Todo component
    await page.goto('http://localhost:6006/iframe.html?id=components-todo--with-todos');
  });

  test('renders todo list with initial items', async ({ page }) => {
    // Check if Todo header exists
    const header = await page.getByText('Todo List');
    await expect(header).toBeVisible();

    // Check if initial todos are displayed
    await expect(page.getByText('Learn React')).toBeVisible();
    await expect(page.getByText('Build a todo app')).toBeVisible();
    await expect(page.getByText('Master TypeScript')).toBeVisible();

    // Check if the count is correct
    await expect(page.getByText('2 items left')).toBeVisible();
  });

  test('can add a new todo', async ({ page }) => {
    // Navigate to the empty todo story
    await page.goto('http://localhost:6006/iframe.html?id=components-todo--empty');
    
    // Type a new todo
    const input = await page.getByPlaceholder('Add a new todo...');
    await input.fill('Write Playwright tests');
    
    // Click add button
    await page.getByText('Add').click();
    
    // Check if the new todo is added
    await expect(page.getByText('Write Playwright tests')).toBeVisible();
    
    // Check if the count is updated
    await expect(page.getByText('1 item left')).toBeVisible();
  });

  test('can toggle a todo', async ({ page }) => {
    // Find the "Learn React" todo and toggle it
    const todos = await page.locator('li');
    const learnReactTodo = todos.filter({ hasText: 'Learn React' });
    const checkbox = await learnReactTodo.locator('input[type="checkbox"]');
    
    // Verify initial state
    await expect(checkbox).not.toBeChecked();
    
    // Toggle the todo
    await checkbox.click();
    
    // Verify that checkbox is now checked
    await expect(checkbox).toBeChecked();
    
    // Verify the active count decreased
    await expect(page.getByText('1 item left')).toBeVisible();
  });

  test('can delete a todo', async ({ page }) => {
    // Count initial todos
    const initialTodos = await page.locator('li').count();
    expect(initialTodos).toBe(3);
    
    // Delete "Learn React" todo
    const learnReactTodo = await page.locator('li').filter({ hasText: 'Learn React' });
    await learnReactTodo.getByText('Delete').click();
    
    // Verify todo was removed
    await expect(page.getByText('Learn React')).not.toBeVisible();
    
    // Verify count of todos decreased
    const remainingTodos = await page.locator('li').count();
    expect(remainingTodos).toBe(2);
  });

  test('can filter todos', async ({ page }) => {
    // Initial view should show all todos
    await expect(page.locator('li')).toHaveCount(3);
    
    // Filter to active todos
    await page.getByText('Active', { exact: true }).click();
    
    // Should only show non-completed todos
    const activeTodos = await page.locator('li');
    await expect(activeTodos).toHaveCount(2);
    await expect(page.getByText('Learn React')).toBeVisible();
    await expect(page.getByText('Master TypeScript')).toBeVisible();
    await expect(page.getByText('Build a todo app')).not.toBeVisible();
    
    // Filter to completed todos
    await page.getByText('Completed', { exact: true }).click();
    
    // Should only show completed todos
    const completedTodos = await page.locator('li');
    await expect(completedTodos).toHaveCount(1);
    await expect(page.getByText('Build a todo app')).toBeVisible();
    await expect(page.getByText('Learn React')).not.toBeVisible();
    
    // Filter back to all
    await page.getByText('All', { exact: true }).click();
    
    // Should show all todos again
    await expect(page.locator('li')).toHaveCount(3);
  });

  test('handles empty state correctly', async ({ page }) => {
    // Navigate to empty state
    await page.goto('http://localhost:6006/iframe.html?id=components-todo--empty');
    
    // No todos should be visible
    await expect(page.locator('li')).toHaveCount(0);
    
    // Count text should show 0 items
    await expect(page.getByText('0 items left')).toBeVisible();
  });
}); 