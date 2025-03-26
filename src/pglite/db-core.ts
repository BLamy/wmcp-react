// db-core.ts - Core database functionality with encryption support
import { PGlite } from '@electric-sql/pglite';
// @ts-expect-error - can't find the type for vector
import { vector } from '@electric-sql/pglite/vector';
import { ParseSchema, DBOperations } from './types';

let dbInstance: PGlite | null = null;
let encryptionKey: CryptoKey | null = null;

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
 * Gets or generates an encryption key for secure database operations
 * In a real application, this would be derived from user credentials or
 * stored in secure storage with proper key management
 */
export async function getEncryptionKey(): Promise<CryptoKey> {
  // If we already have a key in memory, return it
  if (encryptionKey) {
    return encryptionKey;
  }
  
  // Check if we have a key in local storage
  const storedKey = localStorage.getItem('db_encryption_key');
  if (storedKey) {
    try {
      // Import the stored key
      const keyData = JSON.parse(storedKey);
      const importedKey = await window.crypto.subtle.importKey(
        'jwk',
        keyData,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      
      encryptionKey = importedKey;
      return importedKey;
    } catch (error) {
      console.error('Failed to import stored encryption key:', error);
    }
  }
  
  // Generate a new key
  const newKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );
  
  try {
    // Export the key for storage
    const exportedKey = await window.crypto.subtle.exportKey('jwk', newKey);
    localStorage.setItem('db_encryption_key', JSON.stringify(exportedKey));
  } catch (error) {
    console.error('Failed to store encryption key:', error);
  }
  
  encryptionKey = newKey;
  return newKey;
}

/**
 * Encrypts a string value using AES-GCM
 */
async function encryptValue(value: string, key: CryptoKey): Promise<string> {
  // Generate a random IV for each encryption
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // Encode the value as bytes
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(value);
  
  // Encrypt the data
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode.apply(null, Array.from(combined)));
}

/**
 * Decrypts an encrypted string value using AES-GCM
 */
async function decryptValue(encryptedValue: string, key: CryptoKey): Promise<string> {
  try {
    // Convert base64 to array
    const combined = new Uint8Array(
      atob(encryptedValue).split('').map(c => c.charCodeAt(0))
    );
    
    // Extract IV (first 12 bytes)
    const iv = combined.slice(0, 12);
    // Extract encrypted data
    const encryptedData = combined.slice(12);
    
    // Decrypt the data
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    // Decode the result to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[Decryption Failed]';
  }
}

/**
 * Identifies all TEXT fields in a table's schema definition
 */
function getTextFields(schemaSQL: string, tableName: string): string[] {
  // Find the table definition
  const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableName}\\s*\\(([^)]+)\\)`, 'i');
  const tableMatch = schemaSQL.match(tableRegex);
  
  if (!tableMatch || !tableMatch[1]) {
    return [];
  }
  
  // Parse column definitions
  const columnDefinitions = tableMatch[1].split(',');
  const textFields: string[] = [];
  
  // Extract TEXT field names
  for (const columnDef of columnDefinitions) {
    const trimmedDef = columnDef.trim();
    // Match column names followed by TEXT type (case insensitive)
    const columnMatch = trimmedDef.match(/^([^\s]+)\s+TEXT/i);
    if (columnMatch && columnMatch[1]) {
      textFields.push(columnMatch[1].trim());
    }
  }
  
  return textFields;
}

/**
 * Create a typed database operations object with optional encryption
 * for TEXT fields when secure=true
 */
export function createDBOperations<SQL extends string>(
  db: PGlite, 
  schemaSQL: SQL,
  encryptionKey: CryptoKey | null = null,
  debug: boolean = false
): DBOperations<ParseSchema<SQL>> {
  // We'll build an operations object dynamically
  const operations: Record<string, any> = {};

  // Parse table names from schema (runtime parsing, not type-level)
  const tableMatches = [...schemaSQL.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/gi)];
  
  for (const [, tableName] of tableMatches) {
    const table = tableName.trim();
    
    // Identify TEXT fields for this table if in secure mode
    const textFields = encryptionKey ? getTextFields(schemaSQL, table) : [];
    
    if (debug && encryptionKey) {
      console.log(`Table ${table} has encrypted TEXT fields:`, textFields);
    }
    
    operations[table] = {
      // Create operation with encryption support
      create: async (data: Record<string, any>) => {
        // Make a copy to avoid modifying the original data
        const processedData = { ...data };
        
        // Encrypt TEXT fields if in secure mode
        if (encryptionKey && textFields.length > 0) {
          for (const field of textFields) {
            if (processedData[field] && typeof processedData[field] === 'string') {
              processedData[field] = await encryptValue(processedData[field], encryptionKey);
              if (debug) console.log(`Encrypted field ${field} for ${table}`);
            }
          }
        }
        
        const keys = Object.keys(processedData);
        const values = Object.values(processedData);
        const placeholders = keys.map((_, i) => `$${i + 1}`);
        
        const query = `
          INSERT INTO ${table} (${keys.join(', ')})
          VALUES (${placeholders.join(', ')})
          RETURNING *
        `;
        
        const result = await db.query(query, values);
        const resultRow = result.rows[0];
        
        // Decrypt TEXT fields if in secure mode
        if (encryptionKey && textFields.length > 0) {
          const decryptedRow = { ...resultRow };
          for (const field of textFields) {
            if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
              decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey);
              if (debug) console.log(`Decrypted field ${field} for ${table}`);
            }
          }
          return decryptedRow;
        }
        
        return resultRow;
      },
      
      // Find many operation with decryption support
      findMany: async (params?: Record<string, any>) => {
        let query = `SELECT * FROM ${table}`;
        const values: any[] = [];
        
        if (params?.where) {
          // Note: When querying with encrypted fields, only unencrypted fields 
          // or exact match on encrypted fields are reliable
          const whereConditions = Object.entries(params.where).map(([key, value], index) => {
            // For encrypted fields, we'd ideally encrypt the value here, but that
            // would make queries much more complex (need to handle IV consistently)
            // For simplicity, we'll just use the raw value in where clauses
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
        
        // Decrypt TEXT fields in results if in secure mode
        if (encryptionKey && textFields.length > 0) {
          const decryptedRows = await Promise.all(result.rows.map(async (row) => {
            const decryptedRow = { ...row };
            for (const field of textFields) {
              if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
                decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey!);
                if (debug) console.log(`Decrypted field ${field} for ${table}`);
              }
            }
            return decryptedRow;
          }));
          return decryptedRows;
        }
        
        return result.rows;
      },
      
      // Find unique operation with decryption support
      findUnique: async (where: { id: number }) => {
        const result = await db.query(
          `SELECT * FROM ${table} WHERE id = $1 LIMIT 1`,
          [where.id]
        );
        
        if (result.rows.length === 0) {
          return null;
        }
        
        // Decrypt TEXT fields if in secure mode
        if (encryptionKey && textFields.length > 0) {
          const decryptedRow = { ...result.rows[0] };
          for (const field of textFields) {
            if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
              decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey);
              if (debug) console.log(`Decrypted field ${field} for ${table}`);
            }
          }
          return decryptedRow;
        }
        
        return result.rows[0];
      },
      
      // Update operation with encryption support
      update: async (params: { where: { id: number }, data: Record<string, any> }) => {
        const { where, data } = params;
        
        // Make a copy to avoid modifying the original data
        const processedData = { ...data };
        
        // Encrypt TEXT fields if in secure mode
        if (encryptionKey && textFields.length > 0) {
          for (const field of textFields) {
            if (processedData[field] !== undefined && typeof processedData[field] === 'string') {
              processedData[field] = await encryptValue(processedData[field], encryptionKey);
              if (debug) console.log(`Encrypted field ${field} for ${table} update`);
            }
          }
        }
        
        const keys = Object.keys(processedData);
        const values = Object.values(processedData);
        
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
        
        // Decrypt TEXT fields if in secure mode
        if (encryptionKey && textFields.length > 0) {
          const decryptedRow = { ...result.rows[0] };
          for (const field of textFields) {
            if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
              decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey);
              if (debug) console.log(`Decrypted field ${field} for ${table}`);
            }
          }
          return decryptedRow;
        }
        
        return result.rows[0];
      },
      
      // Delete operation with decryption support for returned row
      delete: async (where: { id: number }) => {
        const result = await db.query(
          `DELETE FROM ${table} WHERE id = $1 RETURNING *`,
          [where.id]
        );
        
        if (result.rows.length === 0) {
          return null;
        }
        
        // Decrypt TEXT fields if in secure mode
        if (encryptionKey && textFields.length > 0) {
          const decryptedRow = { ...result.rows[0] };
          for (const field of textFields) {
            if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
              decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey);
              if (debug) console.log(`Decrypted field ${field} for ${table}`);
            }
          }
          return decryptedRow;
        }
        
        return result.rows[0];
      },
      
      // Utility for client-side filtering of encrypted data
      searchDecrypted: encryptionKey && textFields.length > 0 ? 
        async (fieldName: string, searchValue: string): Promise<any[]> => {
          if (!textFields.includes(fieldName)) {
            throw new Error(`Field ${fieldName} is not an encrypted TEXT field in table ${table}`);
          }
          
          // Get all rows and decrypt them
          const allRows = await operations[table].findMany();
          
          // Filter rows where the decrypted field matches the search value
          return allRows.filter(row => {
            const fieldValue = row[fieldName];
            return fieldValue && fieldValue.toLowerCase().includes(searchValue.toLowerCase());
          });
        } : undefined,
      
      // Delete many with a where clause
      deleteMany: async (params?: Record<string, any>) => {
        let query = `DELETE FROM ${table}`;
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
        
        query += ' RETURNING *';
        
        const result = await db.query(query, values);
        
        // Decrypt TEXT fields if in secure mode
          if (encryptionKey && textFields.length > 0) {
          const decryptedRows = await Promise.all(result.rows.map(async (row) => {
            const decryptedRow = { ...row };
            for (const field of textFields) {
              if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
                decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey!);
              }
            }
            return decryptedRow;
          }));
          return decryptedRows;
        }
        
        return result.rows;
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
        
        // Decrypt TEXT fields if in secure mode
        if (encryptionKey && textFields.length > 0) {
          const decryptedRows = await Promise.all(result.rows.map(async (row) => {
            const decryptedRow = { ...row };
            for (const field of textFields) {
              if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
                decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey!);
              }
            }
            return decryptedRow;
          }));
          return decryptedRows;
        }
        
        return result.rows;
      };
    }
  }
  
  return operations as DBOperations<ParseSchema<SQL>>;
}