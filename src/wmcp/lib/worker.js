// Use the Singleton pattern for the pipeline
class Pipeline {
  static MODEL_NAME = 'Supabase/gte-small';
  static FALLBACK_MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
  static instance = null;
  static status = 'initializing';
  static progress = 0;

  static async getInstance(progress_callback = null) {
    try {
      // Import the Transformers.js library dynamically
      const { pipeline, env } = await import('@xenova/transformers');
      
      if (this.instance === null) {
        // Configure the environment
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        
        // Configure hooks for progress tracking
        env.hooks.onModelDownload = (modelName, progress) => {
          this.status = 'downloading';
          this.progress = progress;
          
          // Report back to main thread
          self.postMessage({
            status: 'progress',
            modelStatus: this.status,
            progress: this.progress,
            message: `Downloading model: ${Math.round(progress * 100)}%`
          });
        };
        
        // First try the primary model
        try {
          this.instance = await pipeline('feature-extraction', this.MODEL_NAME, {
            progress_callback: progress_callback,
            quantized: true,
          });
          
          this.status = 'ready';
          self.postMessage({
            status: 'ready',
            modelStatus: this.status,
            message: 'Model loaded and ready'
          });
        } 
        catch (error) {
          console.warn(`Primary model failed to load: ${error.message}. Trying fallback model...`);
          
          // Try the fallback model
          try {
            this.instance = await pipeline('feature-extraction', this.FALLBACK_MODEL_NAME, {
              progress_callback: progress_callback,
              quantized: true,
            });
            
            this.status = 'ready';
            self.postMessage({
              status: 'ready',
              modelStatus: this.status,
              message: 'Fallback model loaded and ready'
            });
          } 
          catch (fallbackError) {
            throw new Error(`Both models failed. Primary: ${error.message}, Fallback: ${fallbackError.message}`);
          }
        }
      }
      
      return this.instance;
    } 
    catch (error) {
      this.status = 'error';
      self.postMessage({
        status: 'error',
        modelStatus: this.status,
        error: error.message,
        message: `Failed to load model: ${error.message}`
      });
      throw error;
    }
  }
}

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  try {
    const { text } = event.data;
    
    // Inform the main thread that we're working
    self.postMessage({
      status: 'initiate',
      modelStatus: Pipeline.status,
      message: 'Starting embedding generation'
    });
    
    // Get the model
    const model = await Pipeline.getInstance((progress) => {
      self.postMessage({
        status: 'progress',
        modelStatus: Pipeline.status,
        progress: Pipeline.progress,
        message: progress.message || 'Processing'
      });
    });
    
    // Generate the embedding
    const output = await model(text, {
      pooling: 'mean',
      normalize: true,
    });
    
    // Extract the embedding from the model output
    const embedding = Array.from(output.data);
    
    // Send the embedding back to the main thread
    self.postMessage({
      status: 'complete',
      embedding
    });
  } 
  catch (error) {
    self.postMessage({
      status: 'error',
      error: error.message,
      message: `Error generating embedding: ${error.message}`
    });
  }
});

// Send an initial status message
self.postMessage({
  status: 'initializing',
  modelStatus: 'initializing',
  message: 'Worker initialized'
}); 