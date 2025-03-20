// index.ts - Main export file
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

// Export types
export * from './types';

// Export core functions
export { getDB, initSchema, createDBOperations } from './db-core';

// Export React context and hooks
export { 
  DatabaseProvider, 
  useDatabase, 
  useTable 
} from './db-context';

// Export the enhanced usePGVectorDB hook
export { usePGVectorDB } from './use-pg-vector-db';

// Re-export PGlite and vector for convenience
export { PGlite, vector };

// Example usage:
/*
  import { DatabaseProvider, useTable } from './index';

  // Define your schema
  const SCHEMA = `
    CREATE TABLE users (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      name TEXT NOT NULL,
      email TEXT
    );
  `;

  // Use the DatabaseProvider in your app
  function App() {
    return (
      <DatabaseProvider schema={SCHEMA}>
        <UserComponent />
      </DatabaseProvider>
    );
  }

  // Use the useTable hook in your components
  function UserComponent() {
    const users = useTable('users');
    
    // Now you have type-safe CRUD operations:
    // users.create({ name: 'John', email: 'john@example.com' })
    // users.findMany({ where: { name: 'John' } })
    // users.update({ where: { id: 1 }, data: { name: 'Jane' } })
    // users.delete({ id: 1 })
    
    return <div>User Component</div>;
  }

  // Or use the usePGVectorDB hook directly
  function AlternativeApp() {
    const db = usePGVectorDB(SCHEMA);
    
    // Access operations through db.operations
    // db.operations.users.create({ name: 'John' })
    
    return <div>Alternative App</div>;
  }
*/
