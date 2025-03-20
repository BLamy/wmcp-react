// use-pg-vector-db.ts - Enhanced version of the original hook
import { useState, useEffect } from 'react';
import { PGlite } from '@electric-sql/pglite';
import { getDB, initSchema, createDBOperations } from './db-core';
import { ParseSchema, DBOperations } from './types';

/**
 * A type-safe hook for PostgreSQL vector database access
 * @param schemaSQL - SQL schema definition with CREATE TABLE statements
 * @param dbName - Optional database name
 * @returns Database interface with operations and state
 */
export function usePGVectorDB<SQL extends string>(
  schemaSQL: SQL,
  dbName: string = 'postgres-vector-db'
) {
  const [db, setDb] = useState<PGlite | null>(null);
  const [operations, setOperations] = useState<DBOperations<ParseSchema<SQL>> | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [tables, setTables] = useState<Record<string, any>>({});

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      try {
        // Get or create the database instance
        const database = await getDB(dbName);
        if (!isMounted) return;
        setDb(database);
        
        // Initialize the schema
        await initSchema(database, schemaSQL);
        
        // Create type-safe operations
        const dbOps = createDBOperations(database, schemaSQL);
        if (!isMounted) return;
        setOperations(dbOps);
        
        // Extract table names for content loading
        const tableMatches = [...schemaSQL.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/gi)];
        const tableContents: Record<string, any> = {};
        
        // Load content from each table
        for (const [, tableName] of tableMatches) {
          const table = tableName.trim();
          try {
            const items = await database.query(`SELECT * FROM ${table}`);
            if (!isMounted) return;
            tableContents[table] = items.rows;
          } catch (tableErr) {
            console.warn(`Failed to load content from table ${table}:`, tableErr);
            tableContents[table] = [];
          }
        }
        
        if (!isMounted) return;
        setTables(tableContents);
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize database:', err);
        if (!isMounted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    if (!isInitialized && !db) {
      initialize();
    }
    
    return () => {
      isMounted = false;
    };
  }, [schemaSQL, dbName, isInitialized, db]);

  return {
    db,
    operations,
    tables,
    isInitialized,
    error,
    
    // For backward compatibility with your original implementation
    ...(operations ?? {}),
    
    // Include vector search function directly for convenience
    search: async (
      tableName: string,
      embedding: number[],
      match_threshold = 0.8,
      limit = 3
    ) => {
      if (!db || !operations) {
        throw new Error('Database not initialized');
      }
      
      const tableOps = operations[tableName];
      if (!tableOps || !tableOps.search) {
        throw new Error(`Table "${tableName}" not found or doesn't support vector search`);
      }
      
      return tableOps.search(embedding, match_threshold, limit);
    }
  };
}
