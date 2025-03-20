// db-context.tsx - React context and provider for database
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PGlite } from '@electric-sql/pglite';
import { getDB, initSchema, createDBOperations } from './db-core';
import { DatabaseContextType, ParseSchema, DBOperations } from './types';

// Create a generic database context
const DatabaseContext = createContext<DatabaseContextType<any>>({
  db: null,
  operations: null,
  isInitialized: false,
  error: null,
});

interface DatabaseProviderProps<SQL extends string> {
  schema: SQL;
  dbName?: string;
  children: ReactNode;
}

/**
 * Database provider component
 */
export function DatabaseProvider<SQL extends string>({
  schema,
  dbName = 'postgres-typesafe-db',
  children,
}: DatabaseProviderProps<SQL>) {
  const [db, setDb] = useState<PGlite | null>(null);
  const [operations, setOperations] = useState<DBOperations<ParseSchema<SQL>> | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        console.log(`[PGlite] Setting up database: ${dbName}`);
        
        // Get or create the database instance
        const database = await getDB(dbName);
        setDb(database);
        console.log(`[PGlite] Database created successfully: ${dbName}`);
        
        // Initialize the schema
        await initSchema(database, schema);
        console.log(`[PGlite] Schema initialized`);
        
        // Create type-safe operations
        const dbOps = createDBOperations(database, schema);
        setOperations(dbOps);
        
        // Mark as initialized
        setIsInitialized(true);
        console.log(`[PGlite] Database initialization complete: ${dbName}`);
      } catch (err) {
        console.error(`[PGlite] Failed to initialize database ${dbName}:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    if (!isInitialized && !db) {
      setupDatabase();
    }
  }, [schema, dbName, isInitialized, db]);

  const value = {
    db,
    operations,
    isInitialized,
    error,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Hook to access the database context
 */
export function useDatabase<Schema>(): DatabaseContextType<Schema> {
  const context = useContext<DatabaseContextType<Schema>>(DatabaseContext as any);
  
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  
  return context;
}

/**
 * Hook to access a specific table in the database
 */
export function useTable<Schema, TableName extends keyof Schema>(
  tableName: TableName
): Schema[TableName] extends object ? DBOperations<Schema>[TableName] | null : null {
  const context = useContext<DatabaseContextType<Schema>>(DatabaseContext as any);
  
  if (context === undefined) {
    throw new Error('useTable must be used within a DatabaseProvider');
  }
  
  const { operations, isInitialized, error } = context;
  
  if (error) {
    throw error;
  }
  
  if (!isInitialized || !operations) {
    return null;
  }
  
  const tableOperations = operations[tableName as string as keyof typeof operations];
  
  if (!tableOperations) {
    return null
  }
  
  return tableOperations as any;
}
