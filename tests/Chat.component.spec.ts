import { test, expect } from '@playwright/test';

test.describe('Chat Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Storybook page for the Chat component
    await page.goto('http://localhost:6006/iframe.html?id=mcp-chat--example');
  });

  test('renders default chat interface', async ({ page }) => {
    // First, verify the API key dialog is shown
    const apiKeyDialog = await page.waitForSelector('text=Anthropic API Key');
    expect(apiKeyDialog).toBeTruthy();

    // Enter an API key
    const apiKeyInput = await page.waitForSelector('input[type="text"]');
    await apiKeyInput.type('test-api-key');

    // Click continue
    const continueButton = await page.waitForSelector('button:has-text("Continue")');
    await continueButton.click();


    // Verify the terminal is present
    const terminal = await page.waitForSelector('[data-testid="xterm-container"]');
    expect(terminal).toBeTruthy();
  });

  test('handles custom server configuration', async ({ page }) => {
    // First handle the API key dialog
    const apiKeyInput = await page.waitForSelector('input[type="text"]');
    await apiKeyInput.type('test-api-key');
    const continueButton = await page.waitForSelector('button:has-text("Continue")');
    await continueButton.click();

    // Open server configuration
    const settingsButton = await page.waitForSelector('button[aria-label="Settings"]');
    await settingsButton.click();

    // Verify server config dialog appears
    const serverConfigDialog = await page.waitForSelector('text=Server Configuration');
    expect(serverConfigDialog).toBeTruthy();

    // Verify debug info is present when DEBUG is true
    const debugInfo = await page.waitForSelector('[data-testid="debug-info"]');
    expect(debugInfo).toBeTruthy();
  });

  test('can send a message', async ({ page }) => {
    // Handle API key dialog first
    const apiKeyInput = await page.waitForSelector('input[type="text"]');
    await apiKeyInput.type('test-api-key');
    const continueButton = await page.waitForSelector('button:has-text("Continue")');
    await continueButton.click();

    // Type and send a message
    const messageInput = await page.waitForSelector('input[placeholder="Type a message..."]');
    await messageInput.type('Hello, AI!');
    const sendButton = await page.waitForSelector('button[aria-label="Send message"]');
    await sendButton.click();

    // Verify message appears in chat
    const message = await page.waitForSelector('text=Hello, AI!');
    expect(message).toBeTruthy();
  });
}); 