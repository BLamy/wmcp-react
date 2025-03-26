// db-context.tsx - React context and provider for database
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PGlite } from '@electric-sql/pglite';
import { getDB, initSchema, createDBOperations, getEncryptionKey } from './db-core';
import { DatabaseContextType, ParseSchema, DBOperations } from './types';

// Create a generic database context
export const DatabaseContext = createContext<DatabaseContextType<any>>({
  $raw: null,
  db: null,
  isInitialized: false,
  error: null,
});

interface DatabaseProviderProps<SQL extends string> {
  schema: SQL;
  dbName?: string;
  secure?: boolean;
  debug?: boolean;
  children: ReactNode;
}

/**
 * Database provider component
 */
export function DatabaseProvider<SQL extends string>({
  schema,
  dbName = 'postgres-typesafe-db',
  secure = false,
  debug = false,
  children,
}: DatabaseProviderProps<SQL>) {
  const [$raw, setRaw] = useState<PGlite | null>(null);
  const [db, setDb] = useState<DBOperations<ParseSchema<SQL>> | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        console.log(`[PGlite] Setting up database: ${dbName}`);

        // Get or create the database instance
        const database = await getDB(dbName);
        setRaw(database);
        console.log(`[PGlite] Database created successfully: ${dbName}`);

        // Initialize the schema
        await initSchema(database, schema);
        console.log(`[PGlite] Schema initialized`);
        // Get encryption key if secure mode is enabled
        let cryptoKey: CryptoKey | null = null;
        if (secure) {
          try {
            cryptoKey = await getEncryptionKey();
            if (debug) console.log('Encryption initialized for secure database operations');
          } catch (error) {
            console.error('Failed to initialize encryption key:', error);
            throw new Error('Could not initialize secure mode: encryption key setup failed');
          }
        }
        // Create type-safe operations
        const sdk = createDBOperations(database, schema, cryptoKey, debug);
        setDb(sdk);
        console.log(`[PGlite] Database operations created`, Object.keys(sdk));
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
    $raw: {
      ...$raw,
      query: async (query: string, params?: any[]) => {
        if (debug) console.log('Query:', query, params);
        const result = await $raw!.query(query, params);
        if (debug) console.log('Result:', result);
        return result;
      }
    },
    db,
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

  const { db, isInitialized, error } = context;

  if (error) {
    throw error;
  }

  if (!isInitialized || !db) {
    return null;
  }

  const tableOperations = db[tableName as string as keyof typeof db];

  if (!tableOperations) {
    return null
  }

  return tableOperations as any;
}
