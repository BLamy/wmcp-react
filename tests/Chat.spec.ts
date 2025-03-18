import { test, expect } from '@playwright/test';

test.describe('Chat Component', () => {
  test('should render the default chat interface', async ({ page }) => {
    // Navigate to the Chat story in Storybook
    await page.goto('/iframe.html?id=components-chat--default');
    
    // Wait for the main chat container to be visible
    await expect(page.locator('main')).toBeVisible();
    
    // Verify the terminal is present
    await expect(page.locator('.xterm')).toBeVisible();
  });

  test('should handle custom server configuration', async ({ page }) => {
    // Navigate to the story with custom config
    await page.goto('/iframe.html?id=components-chat--with-custom-config');
    
    // Wait for the main chat container to be visible
    await expect(page.locator('main')).toBeVisible();
    
    // Add more specific assertions based on your custom config behavior
    // For example, checking if debug elements are present when DEBUG=true
    await expect(page.locator('[data-testid="debug-info"]')).toBeVisible();
  });

  // Add more test cases as needed
}); 