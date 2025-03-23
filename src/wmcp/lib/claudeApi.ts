export const generateClaudeResponse = async (
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  apiKey: string,
  tools?: Tool[]
) => {
  try {
    console.log('Claude API request:', { messages, tools });
    
    const requestBody: any = {
      model: 'claude-3-7-sonnet-20250219', // Use sonnet, not opus
      max_tokens: 4000,
      messages
    };

    // If tools exist, format them for Claude
    if (tools && tools.length > 0) {
      requestBody.tools = formatToolsForClaude(tools);
      console.log('Formatted tools for Claude:', requestBody.tools);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true' // Use direct browser access
      },
      body: JSON.stringify(requestBody)
    });

    // ... existing code ...
  } catch (error) {
    // ... existing code ...
  }
}; 