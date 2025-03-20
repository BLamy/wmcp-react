import { Tool } from '@modelcontextprotocol/sdk/types.js';
// @ts-ignore
import { PGlite } from '@electric-sql/pglite';
// @ts-ignore
import { vector } from '@electric-sql/pglite/vector';

// Configuration
const VECTOR_DIMENSION = 384;
const SIMILARITY_THRESHOLD = 0.8;
const DB_NAME = 'idb://mcp-tool-embeddings';

// Type definitions
interface IndexingResult {
  indexedCount: number;
  failedCount: number;
  details: {
    indexed: string[];
    failed: string[];
  };
}

// Model loading status to track and expose progress
export type ModelStatus = 
  | 'not-initialized' 
  | 'initializing' 
  | 'downloading' 
  | 'loading' 
  | 'ready' 
  | 'error'
  | 'fallback';

// Progress tracking for model loading
export interface ModelProgress {
  status: ModelStatus;
  progress?: number;
  message?: string;
  error?: string;
}

// Database singleton 
let dbInstance: any = null;

// Get or create PGlite database instance
async function getDB() {
  if (dbInstance) {
    return dbInstance;
  }
  
  console.log('Initializing PGlite database with vector extension');
  try {
    const db = new PGlite(DB_NAME, {
      extensions: {
        vector,
      },
    });
    await db.waitReady;
    dbInstance = db;
    return db;
  } catch (error) {
    console.error('Failed to initialize PGlite database:', error);
    throw error;
  }
}

// Initialize schema with tables and indexes
async function initSchema(db: any) {
  try {
    return await db.exec(`
      create extension if not exists vector;
      
      create table if not exists mcp_tool_embeddings (
        id bigint primary key generated always as identity,
        tool_name text not null,
        server_name text not null,
        description text not null,
        embedding vector(${VECTOR_DIMENSION})
      );
      
      create index if not exists mcp_tool_embeddings_vector_idx 
      on mcp_tool_embeddings using hnsw (embedding vector_ip_ops);
    `);
  } catch (error) {
    console.error('Failed to initialize schema:', error);
    throw error;
  }
}

// Count rows in table
async function countRows(db: any, table: string) {
  try {
    const res = await db.query(`SELECT COUNT(*) FROM ${table};`);
    return res.rows[0].count;
  } catch (error) {
    console.error(`Failed to count rows in ${table}:`, error);
    return 0;
  }
}

// Run vector similarity search
async function searchSimilar(
  db: any,
  embedding: number[],
  match_threshold = SIMILARITY_THRESHOLD,
  limit = 5
) {
  try {
    console.log(`Searching for similar tools with threshold ${match_threshold} and limit ${limit}`);
    
    // Ensure embedding is properly formatted for PGlite
    const vectorString = JSON.stringify(embedding);
    
    // First try with the provided threshold
    let res = await db.query(
      `
      select tool_name, server_name, description, embedding <#> $1 AS similarity
      from mcp_tool_embeddings
      
      -- The inner product is negative, so we negate match_threshold
      where embedding <#> $1 < $2
      
      -- Our embeddings are normalized to length 1, so cosine similarity
      -- and inner product will produce the same query results.
      -- Using inner product which can be computed faster.
      order by embedding <#> $1
      limit $3;
      `,
      [vectorString, -Number(match_threshold), Number(limit)]
    );
    
    // If no results, try with a lower threshold to get some results
    if (res.rows.length === 0 && match_threshold > 0.3) {
      console.log(`No results at threshold ${match_threshold}, retrying with lower threshold 0.3`);
      res = await db.query(
        `
        select tool_name, server_name, description, embedding <#> $1 AS similarity
        from mcp_tool_embeddings
        order by embedding <#> $1
        limit $2;
        `,
        [vectorString, Number(limit)]
      );
    }
    
    console.log(`Found ${res.rows.length} similar tools`);
    
    // Convert similarity score to a 0-1 range (where 1 is most similar)
    // The inner product returns negative values, with closer matches being more negative
    // We need to normalize these to 0-1 range where 1 is the best match
    return res.rows.map((row: any) => {
      // Convert inner product to a proper similarity score (0-1 range)
      // First convert from negative to positive (multiply by -1)
      // Then clamp to ensure we don't exceed 1.0
      const similarityScore = Math.min(Math.max(-row.similarity, 0), 1);
      
      return {
        toolName: row.tool_name,
        serverName: row.server_name,
        similarity: similarityScore, // Properly normalized score
        description: row.description
      };
    });
  } catch (error) {
    console.error('Failed to search for similar tools:', error);
    return []; // Return empty array instead of throwing
  }
}

class ToolEmbeddingService {
  private db: any = null;
  private worker: Worker | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private modelStatus: ModelStatus = 'not-initialized';
  private progressListeners: Array<(progress: ModelProgress) => void> = [];
  
  constructor() {
    // We initialize on-demand instead of in constructor
  }
  
  /**
   * Initialize the service
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    
    if (!this.initPromise) {
      this.initPromise = this._initialize();
    }
    
    return this.initPromise;
  }
  
  private async _initialize(): Promise<void> {
    try {
      console.log('Initializing ToolEmbeddingService');
      
      // Initialize database
      this.db = await getDB();
      await initSchema(this.db);
      
      // Initialize worker
      this.initWorker();
      
      // Check table
      const count = await countRows(this.db, 'mcp_tool_embeddings');
      console.log(`Found ${count} tools in embedding database`);
      
      this.initialized = true;
      console.log('ToolEmbeddingService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ToolEmbeddingService:', error);
      // Don't mark as initialized, let it fail
      throw error;
    }
  }
  
  private initWorker() {
    try {
      // Use the worker that matches the example approach
      this.worker = new Worker(new URL('./worker.js', import.meta.url), { 
        type: 'module' 
      });
      
      // Listen for messages from the worker
      this.worker.addEventListener('message', (event) => {
        const { status, modelStatus, progress, message, error } = event.data;
        
        // Update our status if provided
        if (modelStatus) {
          this.modelStatus = modelStatus as ModelStatus;
          
          // Notify progress listeners
          this.notifyProgressListeners({
            status: this.modelStatus,
            progress,
            message,
            error
          });
          
          // If error, throw an exception to crash the service
          if (modelStatus === 'error') {
            throw new Error(`Worker initialization failed: ${error || message || 'Unknown error'}`);
          }
        }
      });
      
      console.log('Embedding worker initialized with exact example approach');
    } catch (error) {
      console.error('Failed to initialize embedding worker:', error);
      this.modelStatus = 'error';
      
      // Throw the error to crash the service
      throw error;
    }
  }
  
  private notifyProgressListeners(progress: ModelProgress) {
    console.log(`Model status: ${progress.status}`, 
      progress.progress !== undefined ? 
        `(${Math.round(progress.progress * 100)}%)` : '',
      progress.message || '');
    
    this.progressListeners.forEach(listener => listener(progress));
  }
  
  /**
   * Subscribe to model loading progress updates
   */
  public onModelProgressUpdate(callback: (progress: ModelProgress) => void) {
    // Initialize if not already done
    if (!this.initialized) {
      this.initialize().catch(err => {
        console.error('Failed to initialize for progress updates:', err);
      });
    }
    
    // Add listener
    this.progressListeners.push(callback);
    
    // Send current status immediately
    callback({
      status: this.modelStatus,
      message: 'Current worker status'
    });
    
    // Return unsubscribe function
    return () => {
      this.progressListeners = this.progressListeners.filter(listener => listener !== callback);
    };
  }
  
  /**
   * Get current model status
   */
  public getModelStatus(): ModelProgress {
    return {
      status: this.modelStatus,
      message: 'Current worker status'
    };
  }
  
  /**
   * Generate embedding for text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    await this.initialize();
    
    if (!this.worker) {
      throw new Error('Embedding worker not initialized');
    }
    
    return new Promise((resolve, reject) => {
      // Handle messages for this specific request
      const messageHandler = (e: MessageEvent) => {
        const { status, embedding, error } = e.data;
        
        if (status === 'complete' && embedding) {
          // Remove the handler when done
          this.worker?.removeEventListener('message', messageHandler);
          resolve(embedding);
        } else if (status === 'error') {
          this.worker?.removeEventListener('message', messageHandler);
          reject(new Error(error || 'Unknown error generating embedding'));
        }
      };
      
      // Add the handler - using non-null assertion since we already checked
      this.worker!.addEventListener('message', messageHandler);
      
      // Send the request to the worker - using non-null assertion
      this.worker!.postMessage({ text });
      
      // Set a timeout
      setTimeout(() => {
        this.worker?.removeEventListener('message', messageHandler);
        reject(new Error('Embedding generation timed out'));
      }, 15000);
    });
  }
  
  /**
   * Index MCP tools using embeddings
   */
  public async indexMcpTools(
    tools: Tool[],
    serverMapping: Record<string, string>
  ): Promise<IndexingResult> {
    await this.initialize();
    
    const result: IndexingResult = {
      indexedCount: 0,
      failedCount: 0,
      details: {
        indexed: [],
        failed: []
      }
    };
    
    // Wait for model to be ready with retries
    const maxWaitAttempts = 30; // 30 * 2 seconds = max 1 minute wait time
    let waitAttempts = 0;
    
    while (this.modelStatus !== 'ready' && waitAttempts < maxWaitAttempts) {
      console.log(`Embedding model not ready yet (${this.modelStatus}), waiting... Attempt ${waitAttempts + 1}/${maxWaitAttempts}`);
      // Wait for 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
      waitAttempts++;
    }
    
    // If still not ready after all attempts, throw error
    if (this.modelStatus !== 'ready') {
      const error = new Error(`Embedding model not ready after waiting ${maxWaitAttempts * 2} seconds`);
      console.error(error);
      throw error;
    }
    
    console.log('Model ready, proceeding with tool indexing');
    
    // Clear existing embeddings
    try {
      await this.db.exec('DELETE FROM mcp_tool_embeddings');
    } catch (error) {
      console.error('Failed to clear existing embeddings:', error);
      throw error;
    }
    
    // Process tools in batches to prevent UI freezing
    const batchSize = 10;
    for (let i = 0; i < tools.length; i += batchSize) {
      const batch = tools.slice(i, i + batchSize);
      
      // Process each tool in the batch
      for (const tool of batch) {
        try {
          console.log('Processing tool', tool.name);
          // Create a rich description for embedding
          const description = this.createRichToolDescription(tool);
          
          // Generate embedding
          const embedding = await this.generateEmbedding(description);
          
          // Validate embedding before storage
          if (!embedding || !Array.isArray(embedding) || embedding.length !== VECTOR_DIMENSION) {
            const error = new Error(`Invalid embedding generated for tool ${tool.name}`);
            console.error(error);
            throw error;
          }
          
          // Ensure all values are valid numbers
          const isValid = embedding.every(val => typeof val === 'number' && !isNaN(val) && isFinite(val));
          if (!isValid) {
            const error = new Error(`Embedding for tool ${tool.name} contains invalid values`);
            console.error(error);
            throw error;
          }
          
          console.log('Storing embedding for:', tool.name);
          
          // Format embedding as JSON string for PGlite
          const vectorString = JSON.stringify(embedding);
          
          // Store in database
          await this.db.query(
            `INSERT INTO mcp_tool_embeddings 
             (tool_name, server_name, description, embedding) 
             VALUES ($1, $2, $3, $4)`,
            [
              tool.name,
              serverMapping[tool.name] || 'unknown',
              description,
              vectorString  // Pass as JSON string for PGlite vector format
            ]
          );
          console.log('Successfully stored embedding for:', tool.name);
          result.indexedCount++;
          result.details.indexed.push(tool.name);
        } catch (error) {
          console.error(`Failed to index tool ${tool.name}:`, error);
          // Don't catch, let it crash
          throw error;
        }
      }
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    console.log(`Indexed ${result.indexedCount} tools, ${result.failedCount} failed`);
    return result;
  }
  
  /**
   * Create a rich description of a tool for better embedding
   */
  private createRichToolDescription(tool: Tool): string {
    let description = `Tool Name: ${tool.name}\n`;
    description += `Description: ${tool.description || 'No description'}\n`;
    
    // Add input schema information if available
    if (tool.inputSchema) {
      description += 'Input Parameters:\n';
      
      try {
        const schema = typeof tool.inputSchema === 'string' 
          ? JSON.parse(tool.inputSchema) 
          : tool.inputSchema;
        
        if (schema.properties) {
          for (const [name, prop] of Object.entries<any>(schema.properties)) {
            description += `- ${name}: ${prop.type || 'any'} - ${prop.description || 'No description'}\n`;
          }
        }
      } catch (error) {
        console.warn(`Could not parse input schema for tool ${tool.name}:`, error);
      }
    }
    
    return description;
  }
  
  /**
   * Find tools that match a user query
   */
  public async findMatchingTools(
    query: string, 
    limit = 5, 
    confidenceThreshold = SIMILARITY_THRESHOLD
  ): Promise<{
    toolName: string;
    serverName: string;
    similarity: number;
    description: string;
    error?: string;
  }[]> {
    await this.initialize();
    
    // Wait for model to be ready with retries
    const maxWaitAttempts = 15; // 15 * 1 second = max 15 seconds wait time (shorter than indexing)
    let waitAttempts = 0;
    
    while (this.modelStatus !== 'ready' && waitAttempts < maxWaitAttempts) {
      console.log(`Embedding model not ready yet for search (${this.modelStatus}), waiting... Attempt ${waitAttempts + 1}/${maxWaitAttempts}`);
      // Wait for 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitAttempts++;
    }
    
    // If still not ready after all attempts, throw error
    if (this.modelStatus !== 'ready') {
      const error = new Error(`Embedding model not ready for search after waiting ${maxWaitAttempts} seconds`);
      console.error(error);
      throw error;
    }
    
    console.log(`Finding matching tools for query: "${query}" with threshold ${confidenceThreshold}`);
    
    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Find similar tools in database
    const results = await searchSimilar(this.db, queryEmbedding, confidenceThreshold, limit);
    console.log(`Found ${results.length} matching tools`, results);
    
    return results;
  }
  
  /**
   * Clear all indexed tools
   */
  public async clearIndex(): Promise<void> {
    await this.initialize();
    
    try {
      await this.db.exec('DELETE FROM mcp_tool_embeddings');
      console.log('Tool index cleared');
    } catch (error) {
      console.error('Failed to clear tool index:', error);
    }
  }

  /**
   * Check if proper semantic search is available
   */
  public isSemanticSearchAvailable(): boolean {
    return this.modelStatus === 'ready';
  }
  
  /**
   * Clean up resources
   */
  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Export a singleton instance
const toolEmbeddingService = new ToolEmbeddingService();
export default toolEmbeddingService; 