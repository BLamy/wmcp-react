import React, { useState, useRef, useEffect, useCallback } from 'react';
import { preview } from '../.storybook/preview';
import { Chat } from '../src/wmcp/components/chat';
import { PGlite } from '@electric-sql/pglite';

// Define ServerConfig type locally since it's not exported
interface ServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Reuse functions from MCPToolRouterChat.stories.tsx
async function getDB() {
  // Use new constructor following MCPToolRouterChat.stories.tsx example
  const pglite = new PGlite({
    database: 'semantic-tools',
  });
  await pglite.exec('CREATE EXTENSION IF NOT EXISTS vector');
  return pglite;
}

const initSchema = async (db: PGlite) => {
  return await db.exec(`
    CREATE TABLE IF NOT EXISTS tool_embeddings (
      id SERIAL PRIMARY KEY,
      tool_name TEXT NOT NULL,
      description TEXT NOT NULL, 
      embedding VECTOR(384) NOT NULL
    );
  `);
};

const countRows = async (db: PGlite, table: "tool_embeddings") => {
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${table}`
  );
  return result.rows[0].count;
};

const search = async (
  db: PGlite,
  embedding: number[],
  match_threshold = 0.8,
  limit = 3
) => {
  const result = await db.query<{ tool_name: string, description: string, similarity: number }>(
    `SELECT 
      tool_name, 
      description, 
      1 - (embedding <=> $1) as similarity 
    FROM 
      tool_embeddings 
    WHERE 
      1 - (embedding <=> $1) > $2
    ORDER BY 
      similarity DESC 
    LIMIT $3`,
    embedding, match_threshold, limit
  );
  return result.rows;
};

// Sample tools for demonstration
const demoTools = [
  { 
    name: 'web_search', 
    description: 'Search the web for information on a given topic.'
  },
  { 
    name: 'calculate', 
    description: 'Perform mathematical calculations.' 
  },
  { 
    name: 'reminder', 
    description: 'Set a reminder for a specific date and time.' 
  },
  { 
    name: 'weather', 
    description: 'Check the weather forecast for a location.' 
  },
  { 
    name: 'translate', 
    description: 'Translate text from one language to another.' 
  },
];

const seedDb = async (db: PGlite) => {
  // In a real implementation, we'd make API calls to get embeddings for each tool
  // This is a simplified placeholder - we'd need real embeddings in production
  for (const tool of demoTools) {
    // This is a placeholder for demonstration - we would need real embedding vectors
    // In a real implementation, we'd call an embedding model
    const placeholderEmbedding = Array(384).fill(0).map(() => Math.random() * 2 - 1);
    
    await db.exec(`
      insert into tool_embeddings (tool_name, description, embedding) values
      ($1, $2, $3)
    `, tool.name, tool.description, placeholderEmbedding);
  }
};

function SemanticToolChat() {
  const [similarTools, setSimilarTools] = useState<Array<{tool_name: string, description: string, similarity: number}>>([]);
  const [ready, setReady] = useState(false);
  const [contextPrompt, setContextPrompt] = useState<string>('');
  
  // Refs
  const db = useRef<Awaited<ReturnType<typeof getDB>>>(null);
  const worker = useRef<Worker | null>(null);
  const initializing = useRef(false);
  const chatRef = useRef<any>(null);

  // Set up DB
  useEffect(() => {
    const setup = async () => {
      initializing.current = true;
      db.current = await getDB();
      await initSchema(db.current);
      let count = await countRows(db.current, 'tool_embeddings');
      console.log(`Found ${count} tool embeddings`);
      if (count === 0) {
        await seedDb(db.current);
        count = await countRows(db.current, 'tool_embeddings');
        console.log(`Seeded ${count} tool embeddings`);
      }
      initializing.current = false;
    };
    
    if (!db.current && !initializing.current) {
      setup();
    }
  }, []);

  // Set up worker for embeddings
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist
      worker.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
      });
    }

    // Create a callback function for messages from the worker thread
    const onMessageReceived = async (e: MessageEvent) => {
      const data = e.data;
      
      if (data.status === 'initiate' || data.status === undefined) {
        setReady(false);
        return;
      }
      
      if (data.status === 'ready') {
        setReady(true);
        return;
      }
      
      if (data.status === 'complete' && data.embedding) {
        // Once we have the embedding, search for similar tools
        if (db.current) {
          const searchResults = await search(db.current, data.embedding);
          console.log({ searchResults });
          setSimilarTools(searchResults);
          
          // Create prompt for chat context
          const toolContext = searchResults.map(tool => 
            `Tool: ${tool.tool_name}\nDescription: ${tool.description}\nSimilarity: ${tool.similarity.toFixed(2)}`
          ).join('\n\n');
          
          setContextPrompt(toolContext);
        }
      }
    };

    // Attach the callback function as an event listener
    worker.current.addEventListener('message', onMessageReceived);

    // Cleanup
    return () => {
      if (worker.current) {
        worker.current.removeEventListener('message', onMessageReceived);
      }
    };
  }, []);

  // Process input to find similar tools
  const processInput = useCallback((text: string) => {
    if (worker.current && text.trim()) {
      worker.current.postMessage({ text });
    }
  }, []);

  // Custom server config for the Chat component 
  const serverConfigs: Record<string, ServerConfig> = {
    'mcp-server-with-context': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
      env: {
        CONTEXT_PROMPT: contextPrompt,
        DEBUG: 'true'
      }
    }
  };

  // Handle message input for both finding tools and sending to chat
  const handleMessageInput = useCallback((message: string) => {
    // Process the message to find relevant tools
    processInput(message);
  }, [processInput]);

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-gray-100 p-4 mb-4">
        <h1 className="text-2xl font-bold mb-2">Semantic Tool Chat</h1>
        <p>As you type, similar tools will be added to the context</p>
      </div>
      
      <div className="flex-1 overflow-auto">
        {/* Display Chat UI with tools in context */}
        <Chat 
          ref={chatRef}
          serverConfigs={serverConfigs}
          onMessageInput={handleMessageInput}
        />
      </div>
      
      {similarTools.length > 0 && (
        <div className="border-t p-4">
          <h3 className="font-semibold mb-2">Tools in Context:</h3>
          <div className="flex flex-wrap gap-2">
            {similarTools.map((tool, i) => (
              <div key={i} className="bg-gray-100 p-2 rounded">
                <p className="font-bold">{tool.tool_name}</p>
                <p className="text-sm">{tool.description}</p>
                <p className="text-xs text-gray-500">Similarity: {tool.similarity.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const meta = preview.meta({
  component: SemanticToolChat,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A chat interface that semantically searches for relevant tools based on user input and adds them to the context.'
      }
    }
  },
  tags: [],
  title: 'MCP/SemanticToolChat'
});

export const Default = meta.story({
  name: 'Default',
  render: () => <SemanticToolChat />
});

export default meta; 