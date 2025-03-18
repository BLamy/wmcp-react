import { test, expect } from '@playwright/test';

test.describe('Chat Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Storybook page for the Chat component
    await page.goto('http://localhost:6006/iframe.html?id=mcp-chat--example');
  });

  test('renders default chat interface', async ({ page }) => {
    // Wait for and verify the main container
    const mainContainer = await page.waitForSelector('main');
    expect(mainContainer).toBeTruthy();

    // Verify the terminal is present
    const terminal = await page.waitForSelector('[data-testid="xterm-container"]');
    expect(terminal).toBeTruthy();
  });

  test('handles custom server configuration', async ({ page }) => {
    // Navigate to the custom config story
    await page.goto('http://localhost:6006/iframe.html?id=mcp-chat--custom-server-config');

    // Wait for and verify the main container
    const mainContainer = await page.waitForSelector('main');
    expect(mainContainer).toBeTruthy();

    // Verify debug info is present when DEBUG is true
    const debugInfo = await page.waitForSelector('[data-testid="debug-info"]');
    expect(debugInfo).toBeTruthy();

    // Test interaction with the chat interface
    const input = await page.waitForSelector('input[type="text"]');
    await input.type('Hello');
    await input.press('Enter');

    // Verify the message appears in the chat
    const message = await page.waitForSelector('text=Hello');
    expect(message).toBeTruthy();
  });

  test('handles chat interactions', async ({ page }) => {
    // Type a message and verify it appears
    const input = await page.waitForSelector('input[type="text"]');
    await input.type('Test message');
    await input.press('Enter');

    // Wait for the message to appear
    const message = await page.waitForSelector('text=Test message');
    expect(message).toBeTruthy();

    // Verify terminal response
    const terminalOutput = await page.waitForSelector('[data-testid="xterm-container"]');
    expect(terminalOutput).toBeTruthy();
  });
}); 