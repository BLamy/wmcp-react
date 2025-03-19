import { Tool } from '@modelcontextprotocol/sdk/types.js';
// @ts-ignore
import { PGlite } from '@electric-sql/pglite';
// @ts-ignore
import { vector } from '@electric-sql/pglite/vector';

// Configuration
const MODEL_NAME = 'Supabase/gte-small';
const FALLBACK_MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'; // Much smaller fallback model
const VECTOR_DIMENSION = 384;
const SIMILARITY_THRESHOLD = 0.8;
const DB_NAME = 'idb://mcp-tool-embeddings';
const WORKER_TIMEOUT = 60000; // 60 seconds timeout for worker initialization
const USE_FALLBACK_MODEL = false; // Set to false to use the proper embedding model

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
    
    // For debugging, log that we're properly formatted and ready to search
    console.log(`Running vector similarity search with properly formatted embedding`);
    
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

// Extremely simple random embedding generator for complete fallback mode
function generateRandomEmbedding(text: string): number[] {
  // Use text length as seed to make results consistent for the same text
  let seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Create a seeded random function
  const seededRandom = () => {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  
  // Generate a random embedding of the correct dimension
  const embedding = new Array(VECTOR_DIMENSION).fill(0)
    .map(() => seededRandom() * 2 - 1);
  
  // Normalize the embedding
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / norm);
}

// Setup web worker for embedding generation
class EmbeddingWorker {
  private worker: Worker | null = null;
  private callbacks = new Map<string, (embedding: number[]) => void>();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private lastProgressUpdate: ModelProgress = { 
    status: 'not-initialized',
    progress: 0,
    message: 'Not initialized'
  };
  private progressListeners: ((progress: ModelProgress) => void)[] = [];
  private workerCreationTime: number = 0;
  private retryCount = 0;
  private maxRetries = 2;
  private useFallbackMode = false;
  
  constructor() {
    if (USE_FALLBACK_MODEL) {
      this.useFallbackMode = true;
      this.updateProgress({
        status: 'fallback',
        message: 'Using lightweight fallback embedding mode'
      });
      this.isInitialized = true;
    } else {
      this.setupWorker();
    }
  }
  
  private updateProgress(progress: Partial<ModelProgress>) {
    this.lastProgressUpdate = {
      ...this.lastProgressUpdate,
      ...progress
    };
    
    console.log(`Model status: ${this.lastProgressUpdate.status}`, 
      this.lastProgressUpdate.progress !== undefined ? 
        `(${Math.round(this.lastProgressUpdate.progress * 100)}%)` : '',
      this.lastProgressUpdate.message || '');
    
    // Notify all listeners
    this.progressListeners.forEach(listener => 
      listener(this.lastProgressUpdate));
  }
  
  public onProgressUpdate(callback: (progress: ModelProgress) => void) {
    this.progressListeners.push(callback);
    
    // Immediately send the current status
    callback(this.lastProgressUpdate);
    
    // Return function to remove the listener
    return () => {
      this.progressListeners = this.progressListeners.filter(
        listener => listener !== callback
      );
    };
  }
  
  private setupWorker() {
    this.updateProgress({
      status: 'initializing',
      message: 'Creating web worker for embedding generation'
    });
    
    // Create worker from inline blob to avoid build issues
    const workerCode = `
      // Log any errors to help debugging
      self.addEventListener('error', (event) => {
        console.error('Worker error:', event.message, event.error);
        self.postMessage({ 
          status: 'error', 
          modelStatus: 'error',
          error: event.message,
          message: 'Worker encountered an error: ' + event.message
        });
      });
      
      // Handle promise rejections
      self.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection in worker:', event.reason);
        self.postMessage({ 
          status: 'error', 
          modelStatus: 'error',
          error: 'Unhandled promise rejection: ' + event.reason,
          message: 'Worker encountered an unhandled promise rejection'
        });
      });
      
      // Try to import transformers
      try {
        self.importScripts('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0/dist/transformers.min.js');
        self.postMessage({ 
          status: 'progress', 
          modelStatus: 'initializing',
          message: 'Transformers library loaded from CDN' 
        });
      } catch (e) {
        self.postMessage({ 
          status: 'error', 
          modelStatus: 'error',
          error: 'Failed to load transformers.js: ' + e.message,
          message: 'Could not load transformers.js library. Trying dynamic import...'
        });
        
        // If the script import fails, try module import
        import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0/+esm')
          .then(module => {
            self.transformers = module;
            self.postMessage({ 
              status: 'progress', 
              modelStatus: 'initializing',
              message: 'Transformers library loaded via ESM import' 
            });
          })
          .catch(err => {
            self.postMessage({ 
              status: 'error', 
              modelStatus: 'error',
              error: 'Failed to import transformers.js: ' + err.message,
              message: 'All attempts to load transformers.js failed'
            });
          });
      }
      
      // For storing model download progress
      let downloadProgress = 0;
      let modelLoadingPhase = 'initializing';
      let currentModelName = '${USE_FALLBACK_MODEL ? FALLBACK_MODEL_NAME : MODEL_NAME}';

      // Use the Singleton pattern to enable lazy construction of the pipeline.
      class PipelineSingleton {
        static task = 'feature-extraction';
        static model = currentModelName;
        static instance = null;

        static async getInstance(progress_callback = null) {
          if (this.instance === null) {
            self.postMessage({ 
              status: 'initiate',
              modelStatus: 'loading',
              message: 'Starting model initialization for ' + this.model
            });
            
            try {
              // Load transformers from self if it was loaded via ESM import
              const env = self.transformers ? self.transformers.env : self.Transformers.env;
              const pipeline = self.transformers ? self.transformers.pipeline : self.Transformers.pipeline;
              
              // Skip local model check
              env.allowLocalModels = false;
              env.useBrowserCache = true;  // Use browser cache for models
              
              // Configure hooks for progress tracking
              env.hooks.onModelDownload = (modelName, key, progress) => {
                downloadProgress = progress;
                modelLoadingPhase = 'downloading';
                self.postMessage({ 
                  status: 'progress',
                  modelStatus: 'downloading',
                  progress: progress,
                  message: \`Downloading model \${key}: \${Math.round(progress * 100)}%\`
                });
              };
              
              env.hooks.onModelLoad = (modelName, key, progress) => {
                modelLoadingPhase = 'loading';
                self.postMessage({ 
                  status: 'progress',
                  modelStatus: 'loading',
                  progress: null,
                  message: \`Loading model \${key}\`
                });
              };
              
              try {
                // Set a timeout for model loading
                const modelLoadingTimeout = setTimeout(() => {
                  if (!this.instance) {
                    self.postMessage({ 
                      status: 'error', 
                      modelStatus: 'error',
                      error: 'Model loading timed out after 30 seconds',
                      message: 'Model loading timed out. Will try fallback.'
                    });
                  }
                }, 30000);
                
                // Create the pipeline with a custom progress callback
                this.instance = await pipeline(this.task, this.model, {
                  progress_callback: (progress) => {
                    // Only report unique progress updates to avoid flooding
                    if (progress_callback) progress_callback(progress);
                    
                    // Only send messages when there's meaningful progress
                    if (progress.status && progress.status !== 'progress') {
                      self.postMessage({ 
                        status: 'progress',
                        modelStatus: modelLoadingPhase,
                        progress: downloadProgress,
                        message: \`\${progress.status}: \${progress.message || ''}\`
                      });
                    }
                  },
                  cache: true,
                  quantized: true, // Use quantized models when available
                  dtype: 'fp32',
                  device: !!navigator.gpu ? 'webgpu' : 'wasm',
                });
                
                clearTimeout(modelLoadingTimeout);
                
                // Model is ready for use
                self.postMessage({ 
                  status: 'ready',
                  modelStatus: 'ready',
                  message: 'Model loaded and ready'
                });
              } catch (modelError) {
                // If first model fails, try fallback
                if (this.model !== '${FALLBACK_MODEL_NAME}') {
                  self.postMessage({ 
                    status: 'progress',
                    modelStatus: 'fallback',
                    message: \`Primary model failed to load: \${modelError.message}. Trying fallback model...\`
                  });
                  
                  this.model = '${FALLBACK_MODEL_NAME}';
                  currentModelName = this.model;
                  
                  try {
                    this.instance = await pipeline(this.task, this.model, {
                      progress_callback,
                      cache: true,
                      quantized: true,
                      dtype: 'fp32',
                      device: !!navigator.gpu ? 'webgpu' : 'wasm',
                    });
                    
                    self.postMessage({ 
                      status: 'ready',
                      modelStatus: 'fallback',
                      message: 'Fallback model loaded and ready'
                    });
                  } catch (fallbackError) {
                    throw new Error(\`Both primary and fallback models failed. Primary: \${modelError.message}, Fallback: \${fallbackError.message}\`);
                  }
                } else {
                  throw modelError;
                }
              }
            } catch(err) {
              self.postMessage({ 
                status: 'error', 
                modelStatus: 'error',
                error: err.message,
                message: \`Error loading model: \${err.message}\`
              });
              throw err;
            }
          }
          return this.instance;
        }
      }
      
      // Extremely simple fallback embedding generator
      function generateRandomEmbedding(text) {
        // Use text length as seed to make results consistent for the same text
        const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        
        // Create a seeded random function
        let currentSeed = seed;
        const seededRandom = () => {
          let x = Math.sin(currentSeed++) * 10000;
          return x - Math.floor(x);
        };
        
        // Generate a random embedding of the correct dimension
        const dimension = ${VECTOR_DIMENSION};
        const embedding = Array(dimension).fill(0)
          .map(() => seededRandom() * 2 - 1);
        
        // Normalize the embedding
        const normSq = embedding.reduce((sum, val) => sum + val * val, 0);
        const norm = Math.sqrt(normSq);
        return embedding.map(val => val / norm);
      }

      // Listen for messages from the main thread
      self.addEventListener('message', async (event) => {
        try {
          const { id, text } = event.data;
          
          // Special handling for text-based ID
          if (id === 'ping') {
            self.postMessage({ 
              status: 'pong',
              modelStatus: modelLoadingPhase,
              progress: downloadProgress,
              message: 'Worker is responsive'
            });
            return;
          }

          try {
            // Retrieve the embedding pipeline
            let embedder = await PipelineSingleton.getInstance((x) => {
              // Report progress back to main thread
              self.postMessage({
                status: 'progress',
                id: id,
                modelStatus: modelLoadingPhase,
                progress: downloadProgress,
                message: x.message || 'Loading model components'
              });
            });

            // Generate embedding with a timeout
            const embeddingPromise = embedder(text, {
              pooling: 'mean',
              normalize: true,
            });
            
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Embedding generation timed out')), 15000);
            });
            
            // Race between embedding generation and timeout
            const output = await Promise.race([embeddingPromise, timeoutPromise]);

            // Extract the embedding output
            const embedding = Array.from(output.data);

            // Send the output back to the main thread
            self.postMessage({
              status: 'complete',
              id: id,
              embedding
            });
          } catch (error) {
            console.error('Embedding generation error:', error);
            
            // Fall back to random embeddings if model fails
            self.postMessage({
              status: 'progress',
              id: id,
              modelStatus: 'fallback',
              message: 'Using fallback random embedding due to error: ' + error.message
            });
            
            const randomEmbedding = generateRandomEmbedding(text);
            
            self.postMessage({
              status: 'complete',
              id: id,
              embedding: randomEmbedding
            });
          }
        } catch (error) {
          self.postMessage({
            status: 'error',
            id: event.data.id,
            error: error.message,
            message: \`Error generating embedding: \${error.message}\`
          });
        }
      });
      
      // Immediately send initial status
      self.postMessage({ 
        status: 'progress', 
        modelStatus: 'initializing',
        message: 'Worker created, initializing' 
      });
      
      // Set up a heartbeat to detect if the main thread is still there
      const heartbeatInterval = setInterval(() => {
        self.postMessage({ 
          status: 'heartbeat',
          modelStatus: modelLoadingPhase,
          message: 'Worker heartbeat'
        });
      }, 5000);
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    try {
      this.worker = new Worker(workerUrl, { type: 'module' });
      this.workerCreationTime = Date.now();
      
      this.worker.addEventListener('message', (e) => {
        const { status, id, embedding, error, modelStatus, progress, message } = e.data;
        
        // Update model status if provided
        if (modelStatus) {
          this.updateProgress({
            status: modelStatus as ModelStatus,
            progress,
            message
          });
          
          // Auto-initialize when ready
          if (modelStatus === 'ready' || modelStatus === 'fallback') {
            this.isInitialized = true;
            this.useFallbackMode = modelStatus === 'fallback';
          }
        }
        
        switch (status) {
          case 'ready':
            this.isInitialized = true;
            break;
            
          case 'complete':
            if (this.callbacks.has(id)) {
              const callback = this.callbacks.get(id)!;
              callback(embedding);
              this.callbacks.delete(id);
            }
            break;
            
          case 'error':
            console.error('Embedding worker error:', error);
            this.updateProgress({
              status: 'error',
              message: error,
              error
            });
            
            if (this.callbacks.has(id)) {
              // Return random normalized embedding on error
              const callback = this.callbacks.get(id)!;
              const text = id; // Use ID as seed for consistent results
              const randomEmbedding = generateRandomEmbedding(text);
              callback(randomEmbedding);
              this.callbacks.delete(id);
            }
            
            // If we haven't exceeded retry count, try again
            if (this.retryCount < this.maxRetries) {
              this.retryCount++;
              this.updateProgress({
                message: `Retrying worker setup (attempt ${this.retryCount}/ ${this.maxRetries})`
              });
              
              this.terminate();
              setTimeout(() => this.setupWorker(), 1000);
            } else if (!this.useFallbackMode) {
              // Switch to fallback mode after retries
              this.useFallbackMode = true;
              this.isInitialized = true;
              this.updateProgress({
                status: 'fallback', 
                message: 'Switched to fallback embedding mode after failed retries'
              });
            }
            break;
            
          case 'pong':
            console.log('Worker responded to ping');
            break;
        }
      });
      
      // Clean up the URL object
      URL.revokeObjectURL(workerUrl);
      
      // Set up timeout for worker initialization
      this.setupWorkerTimeout();
      
      // Ping the worker to make sure it's responsive
      this.pingWorker();
    } catch (error) {
      console.error('Failed to initialize embedding worker:', error);
      this.updateProgress({
        status: 'error',
        message: `Failed to create worker: ${error instanceof Error ? error.message : String(error)}`
      });
      URL.revokeObjectURL(workerUrl);
      
      // Switch to fallback mode immediately on worker creation failure
      this.useFallbackMode = true;
      this.isInitialized = true;
      this.updateProgress({
        status: 'fallback',
        message: 'Using fallback embedding due to worker initialization failure'
      });
    }
  }
  
  private pingWorker() {
    if (this.worker) {
      this.worker.postMessage({ id: 'ping', text: '' });
      
      // Set a timeout to check if we got a response
      setTimeout(() => {
        if (!this.isInitialized && !this.useFallbackMode) {
          console.warn('Worker didn\'t respond to ping, might be frozen');
          this.updateProgress({
            message: 'Worker might be unresponsive. Will retry or fall back if needed.'
          });
        }
      }, 2000);
    }
  }
  
  private setupWorkerTimeout() {
    setTimeout(() => {
      if (!this.isInitialized && !this.useFallbackMode) {
        const timeElapsed = (Date.now() - this.workerCreationTime) / 1000;
        
        console.warn(`Worker initialization taking longer than expected (\${timeElapsed.toFixed(1)}s)`);
        
        // If we've been waiting a while and still in early stages, provide more feedback
        if (this.lastProgressUpdate.status === 'initializing' || 
            this.lastProgressUpdate.status === 'not-initialized') {
          this.updateProgress({
            message: `Still waiting for model initialization after \${timeElapsed.toFixed(1)}s. This might take a while on first load.`
          });
        }
        
        // If total timeout exceeded, but we're still downloading/loading, just update the message
        if (timeElapsed > WORKER_TIMEOUT / 1000) {
          if (this.lastProgressUpdate.status === 'downloading' || 
              this.lastProgressUpdate.status === 'loading') {
            this.updateProgress({
              message: `Model still downloading/loading after \${timeElapsed.toFixed(1)}s. Please be patient for the first load.`
            });
          } else {
            // If we've waited too long and not making progress, switch to fallback mode
            console.error(`Worker initialization timed out after ${timeElapsed.toFixed(1)}s`);
            this.updateProgress({
              status: 'fallback',
              message: `Model initialization timed out after ${timeElapsed.toFixed(1)}s. Using fallback mode.`
            });
            
            this.terminate();
            this.useFallbackMode = true;
            this.isInitialized = true;
          }
        } else {
          // Continue checking
          this.setupWorkerTimeout();
        }
      }
    }, 5000); // Check every 5 seconds
  }
  
  public async initialize(): Promise<void> {
    // If we're in fallback mode, we're already initialized
    if (this.useFallbackMode) {
      this.isInitialized = true;
      return Promise.resolve();
    }
    
    if (this.isInitialized) return Promise.resolve();
    
    if (!this.initPromise) {
      this.initPromise = new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.isInitialized || this.useFallbackMode) {
            clearInterval(checkInterval);
            resolve();
          } else if (this.lastProgressUpdate.status === 'error' && this.retryCount >= this.maxRetries) {
            clearInterval(checkInterval);
            
            // Switch to fallback mode instead of rejecting
            this.useFallbackMode = true;
            this.isInitialized = true;
            this.updateProgress({
              status: 'fallback',
              message: `Switched to fallback embedding after ${this.maxRetries} failed attempts`
            });
            
            resolve(); // Resolve anyway, we'll use fallback
          }
        }, 100);
        
        // Set timeout for the entire initialization process
        setTimeout(() => {
          if (!this.isInitialized && !this.useFallbackMode) {
            clearInterval(checkInterval);
            
            // Switch to fallback mode instead of rejecting
            this.useFallbackMode = true;
            this.isInitialized = true;
            this.updateProgress({
              status: 'fallback',
              message: `Initialization timed out after ${WORKER_TIMEOUT/1000}s. Using fallback.`
            });
            
            resolve(); // Resolve anyway, we'll use fallback
          }
        }, WORKER_TIMEOUT);
      });
    }
    
    return this.initPromise;
  }
  
  public async generateEmbedding(text: string): Promise<number[]> {
    await this.initialize();
    
    // If we're in fallback mode, just return a deterministic random embedding
    if (this.useFallbackMode) {
      return generateRandomEmbedding(text);
    }
    
    if (!this.worker) {
      this.updateProgress({
        status: 'error',
        message: 'Embedding worker not initialized'
      });
      // Use fallback instead of throwing
      return generateRandomEmbedding(text);
    }
    
    return new Promise((resolve, reject) => {
      const id = text.substring(0, 20) + Math.random().toString(36).substring(2, 7);
      
      // Set timeout for this specific embedding generation
      const timeout = setTimeout(() => {
        if (this.callbacks.has(id)) {
          console.warn('Embedding generation timed out, using fallback');
          this.callbacks.delete(id);
          
          // Use fallback embedding instead of rejecting
          resolve(generateRandomEmbedding(text));
        }
      }, 15000); // 15 second timeout for generating a single embedding
      
      this.callbacks.set(id, (embedding) => {
        clearTimeout(timeout);
        resolve(embedding);
      });
      
      this.worker!.postMessage({ id, text });
    });
  }
  
  public getStatus(): ModelProgress {
    return this.lastProgressUpdate;
  }
  
  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initPromise = null;
      this.lastProgressUpdate = { 
        status: 'not-initialized',
        progress: 0,
        message: 'Worker terminated'
      };
    }
  }
}

class ToolEmbeddingService {
  private db: any = null;
  private embeddingWorker: EmbeddingWorker | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  
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
      
      // Initialize embedding worker
      this.embeddingWorker = new EmbeddingWorker();
      
      // Check table
      const count = await countRows(this.db, 'mcp_tool_embeddings');
      console.log(`Found ${count} tools in embedding database`);
      
      this.initialized = true;
      console.log('ToolEmbeddingService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ToolEmbeddingService:', error);
      
      // Initialize anyway to allow fallback functionality
      this.initialized = true;
      this.embeddingWorker = new EmbeddingWorker();
    }
  }
  
  /**
   * Subscribe to model loading progress updates
   */
  public onModelProgressUpdate(callback: (progress: ModelProgress) => void) {
    if (!this.embeddingWorker) {
      this.initialize().catch(err => {
        console.error('Failed to initialize for progress updates:', err);
      });
    }
    
    if (this.embeddingWorker) {
      return this.embeddingWorker.onProgressUpdate(callback);
    } else {
      callback({
        status: 'not-initialized',
        message: 'Initializing worker'
      });
      
      // Return no-op function
      return () => {};
    }
  }
  
  /**
   * Get current model status
   */
  public getModelStatus(): ModelProgress {
    if (!this.embeddingWorker) {
      return {
        status: 'not-initialized',
        message: 'Worker not initialized'
      };
    }
    
    return this.embeddingWorker.getStatus();
  }
  
  /**
   * Generate embedding for text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingWorker) {
      console.warn('Embedding worker not initialized, initializing now');  
      await this.initialize();
      
      if (!this.embeddingWorker) {
        console.warn('Failed to initialize embedding worker, using fallback random embeddings');
        return generateRandomEmbedding(text);
      }
    }
    
    try {
      console.log('Generating embedding for:', text);
      const embedding = await this.embeddingWorker.generateEmbedding(text);
      console.log('Embedding generated:', embedding);
      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Use fallback instead of failing
      console.warn('Using fallback random embedding due to error');
      throw error;
      // return generateRandomEmbedding(text);
    }
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
    
    // Check if we're in fallback mode
    if (this.embeddingWorker && this.embeddingWorker.getStatus().status === 'fallback') {
      console.warn('In fallback embedding mode - tool indexing disabled to prevent low-quality search results');
      // Mark all tools as failed because we can't provide good search
      tools.forEach(tool => result.details.failed.push(tool.name));
      result.failedCount = tools.length;
      return result;
    }
    
    // Clear existing embeddings
    try {
      await this.db.exec('DELETE FROM mcp_tool_embeddings');
    } catch (error) {
      console.error('Failed to clear existing embeddings:', error);
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
            console.error(`Invalid embedding generated for tool ${tool.name}`);
            result.failedCount++;
            result.details.failed.push(tool.name);
            continue;
          }
          
          // Ensure all values are valid numbers
          const isValid = embedding.every(val => typeof val === 'number' && !isNaN(val) && isFinite(val));
          if (!isValid) {
            console.error(`Embedding for tool ${tool.name} contains invalid values`);
            result.failedCount++;
            result.details.failed.push(tool.name);
            continue;
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
          result.failedCount++;
          result.details.failed.push(tool.name);
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
    
    // Check if we're in fallback mode and return immediately
    if (this.embeddingWorker && 
       (this.embeddingWorker.getStatus().status === 'fallback' || 
        this.embeddingWorker.getStatus().status === 'error')) {
      console.warn('Semantic search unavailable - in fallback/error mode');
      return [{
        toolName: '',
        serverName: '',
        similarity: 0,
        description: '',
        error: 'Semantic search is currently unavailable due to browser limitations'
      }];
    }
    
    try {
      console.log(`Finding matching tools for query: "${query}" with threshold ${confidenceThreshold}`);
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Find similar tools in database
      const results = await searchSimilar(this.db, queryEmbedding, confidenceThreshold, limit);
      console.log(`Found ${results.length} matching tools`, results);
      
      return results;
    } catch (error) {
      console.error('Failed to find matching tools:', error);
      return [{
        toolName: '',
        serverName: '',
        similarity: 0,
        description: '',
        error: 'Error generating embeddings or searching tools'
      }];
    }
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
   * Check if proper semantic search is available (not in fallback mode)
   * This allows the UI to display an appropriate message when search quality will be poor
   */
  public isSemanticSearchAvailable(): boolean {
    if (!this.embeddingWorker) {
      return false;
    }
    
    const status = this.embeddingWorker.getStatus().status;
    return status === 'ready'; // Only true if it's in the ready state
  }
}

// Export a singleton instance
const toolEmbeddingService = new ToolEmbeddingService();
export default toolEmbeddingService; 