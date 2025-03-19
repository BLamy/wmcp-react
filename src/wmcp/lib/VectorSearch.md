# Semantic Tool Routing for MCP

This module provides semantic tool routing for MCP (Model Context Protocol) tools using vector embeddings and similarity search.

## Overview

The system enables users to interact with MCP tools using natural language. When a user enters a message, the system:

1. Converts the message to a vector embedding
2. Compares it to the embeddings of all available MCP tools
3. Identifies and activates the most semantically relevant tools

## Components

### ToolEmbeddingService

Located in `ToolEmbeddingService.ts`, this service:

- Loads a small embedding model (Supabase/gte-small)
- Creates vector embeddings for MCP tool descriptions
- Stores embeddings in a local PGlite database with pgvector
- Provides similarity search functionality to find relevant tools

### MCPToolRouterChat

Located in `components/MCPToolRouterChat.tsx`, this React component:

- Provides a chat interface for user interaction
- Processes user messages to find matching tools
- Displays a preview of matching tools before submission
- Executes matching tools when messages are sent

### MCPToolRouter

Located in `components/MCPToolRouter.tsx`, this React component:

- Integrates with the MCP system
- Automatically indexes available MCP tools
- Displays status information and tool availability
- Embeds the MCPToolRouterChat component

## Technical Details

### Embedding Model

- Uses the [Supabase/gte-small](https://huggingface.co/Supabase/gte-small) model
- 384-dimensional embeddings for efficient similarity search
- Loaded dynamically via WebAssembly using @xenova/transformers

### Vector Database

- Uses PGlite for an in-browser SQL database with pgvector extension
- Creates HNSW indexes for fast similarity search
- Normalizes embeddings for consistent similarity results

### Performance Optimizations

- Batched processing prevents UI freezing
- Debouncing prevents excessive calculations during typing
- Tool suggestions are updated as the user types

## Usage

To use this system in your application:

```jsx
import { MCPToolRouter } from './wmcp';

// Define your MCP server configurations
const serverConfigs = {
  'memory': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {}
  },
  // Add other server configs...
};

function App() {
  return (
    <WebcontainerProvider>
      <MCPToolRouter serverConfigs={serverConfigs} />
    </WebcontainerProvider>
  );
}
```

## Dependencies

The system requires the following dependencies:

- @xenova/transformers: For the embedding model
- @electric-sql/pglite: For the vector database
- React 18+: For the UI components

## Customization

You can adjust the following parameters:

- `SIMILARITY_THRESHOLD` (default: 0.75): Controls matching strictness
- `MODEL_NAME` (default: 'Supabase/gte-small'): The embedding model to use
- Debounce time (default: 800ms): Adjust based on typing speed 