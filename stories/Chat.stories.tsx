import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Chat } from '../src/wmcp/components/chat';
import { PGlite } from '@electric-sql/pglite';
import { DatabaseContext, DatabaseProvider } from '../src/pglite/db-context';
// @ts-expect-error - can't find the type for vector
import { vector } from '@electric-sql/pglite/vector';

const meta: Meta<typeof Chat> = {
  title: 'Components/Chat',
  component: Chat,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Chat>;

// Initialize the database with schema and sample data
const initDatabase = async (db: PGlite) => {
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS vector;
    
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      session_id TEXT,
      metadata JSONB
    );
    
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      function_name TEXT NOT NULL,
      arguments JSONB,
      FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
    );
    
    -- Insert sample chat sessions
    INSERT INTO chat_sessions (id, name, created_at, updated_at) VALUES 
      ('session-1', 'Work Projects', '2023-06-10 10:00:00', '2023-06-10 11:30:00'),
      ('session-2', 'Travel Planning', '2023-06-09 15:00:00', '2023-06-09 16:45:00'),
      ('session-3', 'Shopping List', '2023-06-08 09:00:00', '2023-06-08 09:30:00')
    ON CONFLICT (id) DO NOTHING;
    
    -- Insert sample messages for session 1
    INSERT INTO chat_messages (id, role, content, date, session_id) VALUES 
      ('msg-1-1', 'system', 'I am a helpful assistant.', '2023-06-10 10:00:00', 'session-1'),
      ('msg-1-2', 'user', 'Can you help me organize my work projects?', '2023-06-10 10:05:00', 'session-1'),
      ('msg-1-3', 'assistant', 'I''d be happy to help you organize your work projects. Let''s start by listing all your current projects.', '2023-06-10 10:06:00', 'session-1')
    ON CONFLICT (id) DO NOTHING;
    
    -- Insert sample messages for session 2
    INSERT INTO chat_messages (id, role, content, date, session_id) VALUES 
      ('msg-2-1', 'system', 'I am a helpful assistant.', '2023-06-09 15:00:00', 'session-2'),
      ('msg-2-2', 'user', 'I need help planning a trip to Japan.', '2023-06-09 15:10:00', 'session-2'),
      ('msg-2-3', 'assistant', 'Japan is a wonderful destination! When are you planning to visit and for how long?', '2023-06-09 15:11:00', 'session-2'),
      ('msg-2-4', 'user', 'I''m thinking about going for two weeks in October.', '2023-06-09 15:15:00', 'session-2'),
      ('msg-2-5', 'assistant', 'October is a great time to visit Japan. The autumn colors will be beautiful, and the weather should be mild.', '2023-06-09 15:16:00', 'session-2')
    ON CONFLICT (id) DO NOTHING;
    
    -- Insert sample messages for session 3
    INSERT INTO chat_messages (id, role, content, date, session_id) VALUES 
      ('msg-3-1', 'system', 'I am a helpful assistant.', '2023-06-08 09:00:00', 'session-3'),
      ('msg-3-2', 'user', 'I need to create a shopping list for dinner.', '2023-06-08 09:05:00', 'session-3'),
      ('msg-3-3', 'assistant', 'What are you planning to cook for dinner?', '2023-06-08 09:06:00', 'session-3'),
      ('msg-3-4', 'user', 'I want to make pasta with a simple tomato sauce.', '2023-06-08 09:10:00', 'session-3'),
      ('msg-3-5', 'assistant', 'Here''s a shopping list for pasta with tomato sauce: pasta, canned tomatoes, garlic, onion, olive oil, basil, salt, and pepper.', '2023-06-08 09:11:00', 'session-3')
    ON CONFLICT (id) DO NOTHING;
  `);
};

// Create a decorator to provide the database context
const withDatabaseContext = (Story: React.ComponentType) => {
  const [db, setDb] = React.useState<PGlite | null>(null);
  
  React.useEffect(() => {
    const setupDb = async () => {
      const metaDb = new PGlite('idb://chat-sessions', {
        extensions: {
          vector,
        },
      });
      
      await metaDb.waitReady;
      await initDatabase(metaDb);
      setDb(metaDb);
    };
    
    setupDb();
  }, []);
  
  if (!db) {
    return <div>Loading database...</div>;
  }
  
  return (
    <DatabaseContext.Provider value={{ db, operations: null, isInitialized: true, error: null }}>
      <Story />
    </DatabaseContext.Provider>
  );
};

// Default chat with no persistence
export const Example: Story = {
  args: {
    enablePersistence: false,
    serverConfigs: {
      memory: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        env: {}
      }
    }
  }
};

// Chat with persistence enabled to show chat sessions
export const WithChatSessions: Story = {
  args: {
    enablePersistence: true,
    serverConfigs: {
      memory: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        env: {}
      }
    }
  },
  decorators: [withDatabaseContext]
};

// Chat with custom server config
export const CustomServerConfig: Story = {
  args: {
    enablePersistence: true,
    serverConfigs: {
      'memory': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        env: {}
      },
      'filesystem': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
        env: {}
      }
    }
  },
  decorators: [withDatabaseContext]
}; 