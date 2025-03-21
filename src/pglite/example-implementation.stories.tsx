import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { DatabaseProvider } from './db-context';
import { TodoApp, LinearLiteApp } from './example-implementation';
import { StoryContext } from '@storybook/react';



// The schema used for all stories
const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS embeddings (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    content TEXT NOT NULL,
    embedding VECTOR(384)
  );
  
  CREATE INDEX IF NOT EXISTS embeddings_vector_idx ON embeddings USING hnsw (embedding vector_ip_ops);
  
  CREATE TABLE IF NOT EXISTS categories (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    description TEXT
  );
`;

// Create a decorator that uses the DatabaseProvider with a unique name for each story
const withDatabaseContext = (Story: React.ComponentType, context: StoryContext) => (
  <DatabaseProvider schema={SCHEMA} dbName={`storybook-db-${context.name || context.id}`}>
    <Story />
  </DatabaseProvider>
);

const meta: Meta<typeof TodoApp> = {
  title: 'PGlite/Examples',
  component: TodoApp,
  parameters: {
    layout: 'padded',
    actions: { argTypesRegex: '^on.*' }
  },
};

export default meta;
type Story = StoryObj<typeof TodoApp>;

// TodoApp already includes its own DatabaseProvider, so we don't need to add one
export const CompleteTodoApplication: Story = {
  name: 'Todo Application',
  render: () => <TodoApp />,
};

export const LinearLiteImplementation: StoryObj<typeof LinearLiteApp> = {
  name: 'Linear-lite App',
  render: () => <LinearLiteApp />,
  decorators: [withDatabaseContext]
};
