// db-core.ts - Core database functionality
import { PGlite } from '@electric-sql/pglite';
// @ts-expect-error - can't find the type for vector
import { vector } from '@electric-sql/pglite/vector';
import { ParseSchema, DBOperations } from './types';

let dbInstance: PGlite | null = null;

/**
 * Creates or returns a singleton database instance
 */
export async function getDB(dbName: string = 'postgres-typesafe-db') {
  if (dbInstance) {
    return dbInstance;
  }
  
  const db = new PGlite(`idb://${dbName}`, {
    extensions: {
      vector,
    },
  });
  
  await db.waitReady;
  dbInstance = db;
  return db;
}

/**
 * Initialize the database schema
 */
export async function initSchema(db: PGlite, schemaSQL: string): Promise<void> {
  try {
    // Enable vector extension if needed
    if (schemaSQL.toLowerCase().includes('vector')) {
      await db.exec('CREATE EXTENSION IF NOT EXISTS vector;');
    }
    
    // Execute the schema SQL
    await db.exec(schemaSQL);
    console.log('Schema initialized successfully');
  } catch (error) {
    console.error('Error initializing schema:', error);
    throw error;
  }
}

/**
 * Create a typed database operations object
 */
export function createDBOperations<SQL extends string>(
  db: PGlite, 
  schemaSQL: SQL
): DBOperations<ParseSchema<SQL>> {
  // We'll build an operations object dynamically
  const operations: Record<string, any> = {};
  
  // Parse table names from schema (runtime parsing, not type-level)
  const tableMatches = [...schemaSQL.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/gi)];
  
  for (const [, tableName] of tableMatches) {
    const table = tableName.trim();
    
    operations[table] = {
      // Create operation
      create: async (data: Record<string, any>) => {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`);
        
        const query = `
          INSERT INTO ${table} (${keys.join(', ')})
          VALUES (${placeholders.join(', ')})
          RETURNING *
        `;
        
        const result = await db.query(query, values);
        return result.rows[0];
      },
      
      // Find many operation
      findMany: async (params?: Record<string, any>) => {
        let query = `SELECT * FROM ${table}`;
        const values: any[] = [];
        
        if (params?.where) {
          const whereConditions = Object.entries(params.where).map(([key, value], index) => {
            values.push(value);
            return `${key} = $${index + 1}`;
          });
          
          if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
          }
        }
        
        if (params?.orderBy) {
          const orderClauses = Object.entries(params.orderBy).map(([key, dir]) => `${key} ${dir}`);
          query += ` ORDER BY ${orderClauses.join(', ')}`;
        }
        
        if (params?.limit) {
          values.push(params.limit);
          query += ` LIMIT $${values.length}`;
        }
        
        if (params?.offset) {
          values.push(params.offset);
          query += ` OFFSET $${values.length}`;
        }
        
        const result = await db.query(query, values);
        return result.rows;
      },
      
      // Find unique operation
      findUnique: async (where: { id: number }) => {
        const result = await db.query(
          `SELECT * FROM ${table} WHERE id = $1 LIMIT 1`,
          [where.id]
        );
        
        return result.rows.length > 0 ? result.rows[0] : null;
      },
      
      // Update operation
      update: async (params: { where: { id: number }, data: Record<string, any> }) => {
        const { where, data } = params;
        const keys = Object.keys(data);
        const values = Object.values(data);
        
        // No updates to make
        if (keys.length === 0) {
          return (await operations[table].findUnique(where)) as any;
        }
        
        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
        
        const query = `
          UPDATE ${table}
          SET ${setClause}
          WHERE id = $${values.length + 1}
          RETURNING *
        `;
        
        const result = await db.query(query, [...values, where.id]);
        return result.rows[0];
      },
      
      // Delete operation
      delete: async (where: { id: number }) => {
        const result = await db.query(
          `DELETE FROM ${table} WHERE id = $1 RETURNING *`,
          [where.id]
        );
        
        return result.rows[0];
      }
    };
    
    // Add vector search method if table has an 'embedding' column
    // This is a heuristic - we check the schema string for embedding column in this table
    const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\s*\\(([^)]+)\\)`, 'i');
    const tableMatch = schemaSQL.match(tableRegex);
    
    if (tableMatch && tableMatch[1] && tableMatch[1].toLowerCase().includes('embedding') && 
        tableMatch[1].toLowerCase().includes('vector')) {
      operations[table].search = async (
        embedding: number[],
        match_threshold = 0.8,
        limit = 3
      ) => {
        const result = await db.query(
          `
          SELECT * FROM ${table}
          WHERE embedding <#> $1 < $2
          ORDER BY embedding <#> $1
          LIMIT $3
          `,
          [JSON.stringify(embedding), -Number(match_threshold), Number(limit)]
        );
        
        return result.rows;
      };
    }
  }
  
  return operations as DBOperations<ParseSchema<SQL>>;
}
