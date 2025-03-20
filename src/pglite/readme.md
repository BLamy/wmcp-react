# Type-Safe PostgreSQL Database with Vector Support

This library provides a type-safe database API for PostgreSQL with vector support, using React hooks and PGlite. It automatically infers TypeScript types from your SQL schema and provides a Prisma-like API for database operations.

## Features

- **Type-safe database operations**: All CRUD operations are fully typed based on your schema
- **Vector database support**: Built-in support for pgvector operations
- **React hooks**: Easy integration with React applications
- **Schema parsing**: Automatic inference of TypeScript types from SQL schema
- **Prisma-like API**: Familiar API inspired by Prisma

## Installation

```bash
npm install @electric-sql/pglite
```

## Usage

### Using the DatabaseProvider

The recommended way is to wrap your application in a `DatabaseProvider`:

```tsx
import { DatabaseProvider, useTable } from 'pg-typesafe-db';

// Define your schema with PostgreSQL syntax
const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    email TEXT
  );
  
  CREATE TABLE IF NOT EXISTS embeddings (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    content TEXT NOT NULL,
    embedding VECTOR(384)
  );
  
  CREATE INDEX IF NOT EXISTS embeddings_vector_idx 
    ON embeddings USING hnsw (embedding vector_ip_ops);
`;

// Wrap your app with the DatabaseProvider
function App() {
  return (
    <DatabaseProvider schema={SCHEMA} dbName="my-app-db">
      <UsersComponent />
      <EmbeddingsComponent />
    </DatabaseProvider>
  );
}

// Use the useTable hook to access a specific table
function UsersComponent() {
  const users = useTable('users');
  const [userList, setUserList] = useState([]);
  
  useEffect(() => {
    // Fetch all users
    users.findMany().then(setUserList);
  }, [users]);
  
  const handleAddUser = async () => {
    // Create a new user with type checking
    const newUser = await users.create({
      name: 'John Doe',
      email: 'john@example.com'
    });
    
    setUserList([...userList, newUser]);
  };
  
  return (
    <div>
      <h2>Users</h2>
      <button onClick={handleAddUser}>Add User</button>
      <ul>
        {userList.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}

// Vector search example
function EmbeddingsComponent() {
  const embeddings = useTable('embeddings');
  const [results, setResults] = useState([]);
  
  const handleSearch = async () => {
    // Generate a random vector for demo purposes
    const vector = Array(384).fill(0).map(() => Math.random());
    
    // Search for similar embeddings
    const searchResults = await embeddings.search(vector, 0.8, 5);
    setResults(searchResults);
  };
  
  return (
    <div>
      <h2>Vector Search</h2>
      <button onClick={handleSearch}>Search Similar</button>
      <ul>
        {results.map(item => (
          <li key={item.id}>{item.content}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Using the usePGVectorDB Hook Directly

Alternatively, you can use the `usePGVectorDB` hook directly:

```tsx
import { usePGVectorDB } from 'pg-typesafe-db';

function App() {
  const db = usePGVectorDB(SCHEMA);
  const [items, setItems] = useState([]);
  
  useEffect(() => {
    if (db.isInitialized && db.operations) {
      // Access tables directly through db.operations
      db.operations.users.findMany().then(setItems);
    }
  }, [db.isInitialized, db.operations]);
  
  const handleAddItem = async () => {
    if (!db.operations) return;
    
    const created = await db.operations.users.create({
      name: 'New User',
      email: 'user@example.com'
    });
    
    setItems([...items, created]);
  };
  
  if (!db.isInitialized) {
    return <div>Loading database...</div>;
  }
  
  return (
    <div>
      <button onClick={handleAddItem}>Add User</button>
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## API

### DatabaseProvider

Provides database context to your application:

```tsx
<DatabaseProvider schema={sqlSchema} dbName="optional-db-name">
  {children}
</DatabaseProvider>
```

### useTable

Access operations for a specific table:

```tsx
const users = useTable('users');

// Available operations:
users.create(data) 
users.findMany({ where, orderBy, limit, offset })
users.findUnique({ id })
users.update({ where: { id }, data })
users.delete({ id })

// For tables with vector columns:
users.search(embedding, match_threshold, limit)
```

### usePGVectorDB

A hook that provides direct access to the database:

```tsx
const db = usePGVectorDB(sqlSchema);

// Access state
db.isInitialized
db.error

// Access operations
db.operations.tableName.create(...)

// Direct vector search
db.search(tableName, embedding, match_threshold, limit)
```

## Type Safety

The library automatically infers TypeScript types from your SQL schema:

```tsx
// Example schema
const SCHEMA = `
  CREATE TABLE users (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    email TEXT
  );
`;

// TypeScript will infer these types:
type Schema = {
  users: {
    id: number;
    name: string;
    email: string;
  }
}

// Operations are fully typed:
users.create({ 
  name: 'John',  // Required
  email: 'john@example.com'  // Optional
});

// TypeScript errors:
users.create({}); // Error: name is required
users.create({ name: 123 }); // Error: name should be string
```

## Vector Operations

For tables with vector columns, you can perform similarity searches:

```tsx
// Create an embedding
const embedding = await embeddings.create({
  content: 'Sample text',
  embedding: vector // number[]
});

// Search for similar embeddings
const results = await embeddings.search(
  queryVector,  // The vector to search for
  0.8,          // Similarity threshold (0-1)
  5             // Limit results
);
```

## License

MIT
