# React Model Context Protocol (MCP) Library

This library provides React components and hooks for working with Model Context Protocol (MCP) servers in a WebContainer environment.

## Installation

First, make sure you have the required dependencies:

```bash
npm install @webcontainer/api @modelcontextprotocol/sdk
```

## Basic Usage

### 1. Setup the Providers

First, wrap your application with the `WebcontainerProvider` to boot the WebContainer environment:

```jsx
import { WebcontainerProvider } from './wmcp';

function App() {
  return (
    // There can only be 1 webcontainer per app. This should be at the root
    <WebcontainerProvider>
        <YourApp />
    </WebcontainerProvider>
  );
}
```

### 2. Use the MCP Hooks

You can use the `useMCPServer` hook to interact with the MCP servers:

```jsx
import { useMCPServer } from './wmcp';
import { useState, useEffect } from 'react';

type MCPServerStatus = 'NO_WEBCONTAINER_CONTEXT' | 'INSTALLING_NODE_MODULES' | 'STARTING' | 'READY' | 'RESTARTING' | 'ERROR'

function PromptsList() {
  const {
    status,
    capibiliites,
    // Cached prompts and tools populated at connection
    prompts, 
    tools, 
    resources, 
    // 
    executePrompt, 
    executeTool, 
    fetchResource,
    //  
    refreshPrompts,
    refreshTools,
    refreshResources
  } = useMCPServer({
    mcpServers: {
        "server-everything": {
            command: "npx",
            args:["-y","@modelcontextprotocol/server-memory"],
            env:{}
        }
    }
  });

  if (status === 'ERROR') return <div>Error: {error.message}</div>;
  if (status !== 'READY') return <div>Loading...</div>;


  return (
    <div>
      <h2>Available Prompts</h2>
      <ul>
        {prompts.map(prompt => (
          <li key={prompt.id} onClick={() => executePrompt(prompt.id)}>
            <strong>{prompt.name}</strong>
            <p>{prompt.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```


## Advanced Usage

### Custom Server Configuration

You can configure multiple MCP servers which will be managed automatically:

```jsx
const client = useMCPServer({
    mcpServers: {
        'memory-server': {
            command: 'npx',
            args: ['@modelcontextprotocol/server-memory'],
            env: {}
        },
        'filesystem-server': {
            command: 'node',
            args: ['path/to/fs-server.js'],
            env: {
            ROOT_DIR: '/tmp/storage'
            }
        },
        'llm-server': {
            command: 'python',
            args: ['path/to/llm_server.py'],
            env: {
            MODEL_PATH: '/models/tiny-llama',
            API_KEY: 'your-api-key'
            }
        }
    }
});
```

### Direct Access to WebContainer

If you need direct access to the WebContainer instance:

```jsx
import { useWebcontainer } from './wmcp';

function WebContainerStatus() {
  const { instance, isReady, error } = useWebcontainer();
  
  if (error) return <div>Error: {error.message}</div>;
  if (!isReady) return <div>WebContainer is starting...</div>;
  
  // Now you can use the WebContainer instance directly
  const handleFileSystem = async () => {
    await instance.fs.writeFile('/tmp/hello.txt', 'Hello, WebContainer!');
    const content = await instance.fs.readFile('/tmp/hello.txt', 'utf-8');
    console.log(content);
  };
  
  return (
    <div>
      <h2>WebContainer is ready</h2>
      <button onClick={handleFileSystem}>Test File System</button>
    </div>
  );
}
```

## Architecture

This library uses a layered architecture:

1. **WebContainer Layer**: Provides the WebContainer instance for running sandboxed code in the browser
2. **MCP Layer**: Uses the WebContainer to run MCP servers and communicate with them
3. **React Component Layer**: Provides hooks and components for easy integration with React applications

This separation allows you to use only the WebContainer functionality if you don't need MCP, or use both together seamlessly.

## API Reference

### Components

- `WebcontainerProvider`: Boots and provides the WebContainer instance

### Hooks

- `useWebcontainer()`: Access the WebContainer instance directly
- `useMCPServer(config)`: Hook for using MCP with custom configuration

## Browser Requirements

This library requires browsers that support SharedArrayBuffer, which means they need:

- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Embedder-Policy: require-corp

Make sure your server sends these headers.