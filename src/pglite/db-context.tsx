// src/pglite/db-context.tsx - MODIFICATION v2
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PGlite } from '@electric-sql/pglite';
import { getDB, initSchema, createDBOperations } from './db-core';
import { DatabaseContextType, ParseSchema, DBOperations } from './types';

export const DatabaseContext = createContext<DatabaseContextType<any>>({
  $raw: null,
  db: null,
  isInitialized: false,
  error: null,
});

interface DatabaseProviderProps<SQL extends string> {
  schema: SQL;
  dbName?: string;
  encryptionKey?: CryptoKey | null; // Keep encryptionKey prop
  debug?: boolean;
  children: ReactNode;
}

/**
 * Database provider component
 * Encryption is automatically enabled if a non-null encryptionKey is provided.
 */
export function DatabaseProvider<SQL extends string>({
  schema,
  dbName = 'postgres-typesafe-db',
  encryptionKey = null, // Default to null
  debug = false,
  children,
}: DatabaseProviderProps<SQL>) {
  const [$raw, setRaw] = useState<PGlite | null>(null);
  const [db, setDb] = useState<DBOperations<ParseSchema<SQL>> | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);


  useEffect(() => {
    // Flag to prevent setup if component unmounts quickly
    let isMounted = true;

    const setupDatabase = async () => {
      // Determine if secure operations are intended for this render
      const isSecure = !!encryptionKey;

      try {
        if (debug) console.log(`[PGlite ${dbName}] Setting up database. Encryption ${isSecure ? 'ENABLED' : 'DISABLED'}.`);

        // Get DB instance (this is fast if already initialized)
        const database = await getDB(dbName);
        if (!isMounted) return; // Check if unmounted
        setRaw(database);
        if (debug) console.log(`[PGlite ${dbName}] Database instance obtained.`);

        // Initialize schema (idempotent)
        await initSchema(database, schema);
        if (!isMounted) return; // Check if unmounted
        if (debug) console.log(`[PGlite ${dbName}] Schema initialized.`);

        // Create operations, passing the key (which might be null)
        // createDBOperations will handle null key internally
        const sdk = createDBOperations(database, schema, encryptionKey, debug);
        if (!isMounted) return; // Check if unmounted
        setDb(sdk);
        if (debug) console.log(`[PGlite ${dbName}] Database operations created.`);

        // Mark as initialized
        setIsInitialized(true);
        setError(null); // Clear previous errors on successful init
        if (debug) console.log(`[PGlite ${dbName}] Database initialization complete.`);

      } catch (err) {
        if (!isMounted) return; // Check if unmounted
        console.error(`[PGlite ${dbName}] Failed to initialize database:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsInitialized(false); // Ensure state reflects error
        setDb(null); // Clear operations on error
      }
    };

    // Reset state when key/schema/name changes before re-initializing
    // This ensures components don't use stale 'db' operations
    setIsInitialized(false);
    setDb(null);
    setError(null);
    setRaw(null); // Also reset raw instance if config changes

    // Run setup
    setupDatabase();

    // Cleanup function
    return () => {
      isMounted = false;
      if (debug) console.log(`[PGlite ${dbName}] Provider unmounting or dependencies changed.`);
      // Note: We don't close the PGlite instance here as it's shared via getDB
    };

  // Re-run effect if schema, dbName, or the encryptionKey itself changes.
  // `debug` is unlikely to change but included for completeness.
  }, [schema, dbName, encryptionKey, debug]); // Dependency on encryptionKey handles login/logout

  const value = {
    // Provide the raw PGlite instance, potentially wrapped for debugging
    $raw: $raw ? {
      ...$raw,
      query: async (query: string, params?: any[]) => {
        if (debug) console.log(`[PGlite Query - ${dbName}]`, query, params);
        try {
            const result = await $raw!.query(query, params);
            if (debug) console.log(`[PGlite Result - ${dbName}]`, result);
            return result;
        } catch(e) {
             console.error(`[PGlite Error - ${dbName}] Query: ${query}`, e);
             throw e;
        }
      }
    } : null,
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
