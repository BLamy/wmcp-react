// type-validation.ts - Verify the type safety of our implementation
import { Expect, Equal, ParseSchema } from './types';
import { usePGVectorDB } from './use-pg-vector-db';
import { useTable } from './db-context';

// Test schema
const TEST_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  );
  
  CREATE TABLE posts (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title TEXT NOT NULL,
    content TEXT,
    author_id BIGINT REFERENCES users(id)
  );
  
  CREATE TABLE embeddings (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    content TEXT NOT NULL,
    embedding VECTOR(384)
  );
`;

// Expected parsed schema type
type ExpectedSchema = {
  users: {
    id: number;
    name: string;
    email: string;
  };
  posts: {
    id: number;
    title: string;
    content: string;
    author_id: number;
  };
  embeddings: {
    id: number;
    content: string;
    embedding: number[];
  };
};

// Type-level validation
type ParsedSchema = ParseSchema<typeof TEST_SCHEMA>;
type SchemaTest = Expect<Equal<ParsedSchema, ExpectedSchema>>;

// Validate hook return types
function typeCheck() {
  // Test usePGVectorDB hook
  const db = usePGVectorDB(TEST_SCHEMA);
  
  // Check if operations are correctly typed
  if (db.operations) {
    // Should have users, posts, and embeddings tables
    const user = db.operations.users.create({ 
      name: 'John', 
      email: 'john@example.com' 
    });
    
    const post = db.operations.posts.create({ 
      title: 'Hello', 
      content: 'World', 
      author_id: 1 
    });
    
    const embedding = db.operations.embeddings.create({
      content: 'Sample',
      embedding: Array(384).fill(0)
    });
    
    // Type check on vector search
    const search = db.operations.embeddings.search?.(
      Array(384).fill(0),
      0.8,
      10
    );
    
    // @ts-expect-error - This should fail because 'missing' is not a table
    db.operations.missing;
    
    // @ts-expect-error - This should fail due to type mismatch
    db.operations.users.create({ name: 123 });
    
    // @ts-expect-error - This should fail due to missing required field
    db.operations.users.create({ email: 'test@example.com' });
  }
  
  // Test useTable hook
  const usersTable = useTable<ExpectedSchema, 'users'>('users');
  
  // Type checking
  const createUser = usersTable?.create({ 
    name: 'Jane', 
    email: 'jane@example.com' 
  });
  
  // @ts-expect-error - This should fail due to type mismatch
  usersTable?.create({ name: 123 });
  
  // Test vector search table
  const embeddingsTable = useTable<ExpectedSchema, 'embeddings'>('embeddings');
  
  // Check search method exists
  const searchResults = embeddingsTable?.search?.(
    Array(384).fill(0),
    0.8,
    10
  );
}

// Export validator function
export function validateTypeSystem() {
  // This function exists to run the TypeScript type checker
  // It doesn't need to do anything at runtime
  return "Type system validated";
}
