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
export function getTextFields(schemaSQL: string, tableName: string): string[] {
  // Find the table definition using a regex that can handle complex schemas
  const tableRegexPattern = `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableName}\\s*\\(([\\s\\S]*?)\\);`;
  const tableRegex = new RegExp(tableRegexPattern, 'i');
  const tableMatch = schemaSQL.match(tableRegex);
  
  if (!tableMatch || !tableMatch[1]) {
    return [];
  }
  
  // Get the column definitions as a string
  const columnDefinitionsStr = tableMatch[1];
  
  // Use a proper SQL column parser
  // This handles nested parentheses and complex definitions correctly
  const textFields: string[] = [];
  
  // Split by comma but respect parentheses nesting
  const columnDefinitions = splitSqlColumns(columnDefinitionsStr);
  
  for (const columnDef of columnDefinitions) {
    const trimmedDef = columnDef.trim();
    
    // Match column names followed by TEXT type (case insensitive)
    // But avoid matching within REFERENCES clauses
    const columnMatch = /^(\w+)\s+TEXT\b/i.exec(trimmedDef);
    
    if (columnMatch && columnMatch[1]) {
      textFields.push(columnMatch[1].trim());
    }
  }
  
  return textFields;
}

/**
 * Helper function to split SQL column definitions while respecting nested parentheses
 */
function splitSqlColumns(sqlStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;
  
  for (let i = 0; i < sqlStr.length; i++) {
    const char = sqlStr[i];
    
    if (char === '(' && !isInQuotes(sqlStr, i)) {
      depth++;
      current += char;
    } else if (char === ')' && !isInQuotes(sqlStr, i)) {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0 && !isInQuotes(sqlStr, i)) {
      // Only split on commas at the top level
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    result.push(current);
  }
  
  return result;
}

/**
 * Helper to check if a position is inside a quoted string
 */
function isInQuotes(str: string, pos: number): boolean {
  let inSingleQuotes = false;
  let inDoubleQuotes = false;
  
  for (let i = 0; i < pos; i++) {
    if (str[i] === "'" && (i === 0 || str[i-1] !== '\\')) {
      inSingleQuotes = !inSingleQuotes;
    } else if (str[i] === '"' && (i === 0 || str[i-1] !== '\\')) {
      inDoubleQuotes = !inDoubleQuotes;
    }
  }
  
  return inSingleQuotes || inDoubleQuotes;
}

/**
 * Create a typed database operations object with optional encryption
 * for TEXT fields when secure=true
 */
export function createDBOperations<SQL extends string>(
  db: PGlite,
  schemaSQL: SQL,
  encryptionKey: CryptoKey | null, // Key is nullable
  debug: boolean = false
): DBOperations<ParseSchema<SQL>> {
  const operations: Record<string, any> = {};

  const tableMatches = [...schemaSQL.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/gi)];

  for (const [, tableName] of tableMatches) {
    const table = tableName.trim();

    // Determine if encryption should be used for this table's operations
    const useEncryption = !!encryptionKey; // Base check on key presence
    const textFields = useEncryption ? getTextFields(schemaSQL, table) : [];

    // Optional: Log if encryption is active for this table's operations
    // if (debug && useEncryption && textFields.length > 0) {
    //   console.log(`[DB Core - ${table}] Encryption ENABLED for fields:`, textFields);
    // } else if (debug) {
    //    console.log(`[DB Core - ${table}] Encryption DISABLED.`);
    // }

    operations[table] = {
      // --- create operation ---
      create: async (data: Record<string, any>) => {
        const processedData = { ...data };
        if (useEncryption && textFields.length > 0) {
          for (const field of textFields) {
            if (processedData[field] && typeof processedData[field] === 'string') {
              processedData[field] = await encryptValue(processedData[field], encryptionKey!);
            }
          }
        }
        // ... (rest of create logic - insert query) ...
        const keys = Object.keys(processedData);
        const values = Object.values(processedData);
        const placeholders = keys.map((_, i) => `$${i + 1}`);
        const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
        const result = await db.query(query, values);
        const resultRow = result.rows[0];

        // Decrypt response
        if (useEncryption && textFields.length > 0) {
          const decryptedRow = { ...resultRow } as Record<string, any>;
          for (const field of textFields) {
            if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
              try {
                decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey!);
              } catch (e) { decryptedRow[field] = '[DECRYPTION FAILED]'; }
            }
          }
          return decryptedRow;
        }
        return resultRow;
      },

      // --- findMany operation ---
      findMany: async (params?: Record<string, any>) => {
        let query = `SELECT * FROM ${table}`;
        const values: any[] = [];
         if (params?.where) {
           const whereConditions = Object.entries(params.where).map(([key, value], index) => {
             if (useEncryption && textFields.includes(key)) {
                console.warn(`[DB Core] Querying encrypted field '${key}' in WHERE clause is not supported reliably.`);
                return null;
             }
             values.push(value);
             return `${key} = $${index + 1}`;
           }).filter(Boolean);
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
        if (useEncryption && textFields.length > 0) {
          return Promise.all(result.rows.map(async (row) => {
            const decryptedRow = { ...row } as Record<string, any>;
            for (const field of textFields) {
              if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
                 try { decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey!); }
                 catch (e) { decryptedRow[field] = '[DECRYPTION FAILED]'; }
              }
            }
            return decryptedRow;
          }));
        }
        return result.rows;
      },
       // --- findUnique operation ---
       findUnique: async (where: { id: number }) => {
         const result = await db.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [where.id]);
         if (result.rows.length === 0) return null;
         const row = result.rows[0];
         if (useEncryption && textFields.length > 0) {
           const decryptedRow = { ...row } as Record<string, any>;
           for (const field of textFields) {
             if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
                try { decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey!); }
                catch (e) { decryptedRow[field] = '[DECRYPTION FAILED]'; }
             }
           }
           return decryptedRow;
         }
         return row;
       },
      // --- update operation ---
      update: async (params: { where: { id: number }, data: Record<string, any> }) => {
        const { where, data } = params;
        const processedData = { ...data };
        if (useEncryption && textFields.length > 0) {
          for (const field of textFields) {
            if (processedData[field] !== undefined && typeof processedData[field] === 'string') {
              processedData[field] = await encryptValue(processedData[field], encryptionKey!);
            }
          }
        }
        const keys = Object.keys(processedData);
        const values = Object.values(processedData);
        if (keys.length === 0) return (await operations[table].findUnique(where)) as any;
        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
        const query = `UPDATE ${table} SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`;
        const result = await db.query(query, [...values, where.id]);
        const resultRow = result.rows[0];
         if (useEncryption && textFields.length > 0) {
           const decryptedRow = { ...resultRow } as Record<string, any>;
           for (const field of textFields) {
             if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
                try { decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey!); }
                catch (e) { decryptedRow[field] = '[DECRYPTION FAILED]'; }
             }
           }
           return decryptedRow;
         }
        return resultRow;
      },
      // --- delete operation ---
      delete: async (where: { id: number }) => {
        const result = await db.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [where.id]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
         if (useEncryption && textFields.length > 0) {
           const decryptedRow = { ...row } as Record<string, any>;
           for (const field of textFields) {
             if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
                try { decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey!); }
                catch (e) { decryptedRow[field] = '[DECRYPTION FAILED]'; }
             }
           }
           return decryptedRow;
         }
        return row;
      },
        // --- deleteMany operation ---
        deleteMany: async (params?: Record<string, any>) => {
          let query = `DELETE FROM ${table}`;
          const values: any[] = [];
          if (params?.where) {
            const whereConditions = Object.entries(params.where).map(([key, value], index) => {
               if (useEncryption && textFields.includes(key)) return null; // Skip encrypted fields in WHERE
              values.push(value);
              return `${key} = $${index + 1}`;
            }).filter(Boolean);
            if (whereConditions.length > 0) query += ` WHERE ${whereConditions.join(' AND ')}`;
          }
          query += ' RETURNING *';
          const result = await db.query(query, values);
          if (useEncryption && textFields.length > 0) {
            return Promise.all(result.rows.map(async (row) => {
              const decryptedRow = { ...row } as Record<string, any>;
              for (const field of textFields) {
                if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
                  try { decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey!); }
                  catch(e) { decryptedRow[field] = '[DECRYPTION FAILED]'; }
                }
              }
              return decryptedRow;
            }));
          }
          return result.rows;
        },
        // --- search operation (if applicable) ---
       search: operations[table]?.search ? async ( embedding: number[], match_threshold = 0.8, limit = 3) => {
         const result = await db.query(
           `SELECT *, embedding <#> $1 AS similarity FROM ${table} WHERE embedding <#> $1 < $2 ORDER BY embedding <#> $1 LIMIT $3`,
           [JSON.stringify(embedding), -Number(match_threshold), Number(limit)]
         );
         if (useEncryption && textFields.length > 0) {
            return Promise.all(result.rows.map(async (row) => {
             const decryptedRow = { ...row } as Record<string, any>;
             for (const field of textFields) {
               if (decryptedRow[field] && typeof decryptedRow[field] === 'string') {
                  try { decryptedRow[field] = await decryptValue(decryptedRow[field], encryptionKey!); }
                  catch(e) { decryptedRow[field] = '[DECRYPTION FAILED]'; }
               }
             }
             return decryptedRow;
           }));
         }
         return result.rows;
       } : undefined, // End of search definition
    };
  }

  return operations as DBOperations<ParseSchema<SQL>>;
}