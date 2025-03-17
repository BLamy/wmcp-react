function addLogToTerminal(log: string, level: 'info' | 'warning' | 'error' | 'success') {
    console.log(log)
}
const processOutputData: Map<string, string> = new Map();
  
export type PendingRequest = {
    message: any;
    timestamp: number;
}
type ServerProcess = {
    input: WritableStream<string>;
    output?: ReadableStream<Uint8Array | string>;
    stderr?: ReadableStream<Uint8Array | string>;
    kill?: () => void;
    exit?: Promise<any>;
};

export class WebContainerStdioTransport {
    private inputWriter: WritableStreamDefaultWriter<string>;
    private onServerReady?: () => void;
    private buffer: string = '';
    public onmessage: ((message: any) => void) | null = null;
    public onclose: (() => void) | undefined = undefined;
    public onerror: ((error: Error) => void) | undefined = undefined;
    private isStarted: boolean = false;
    private pendingRequests: Map<string | number, PendingRequest> = new Map();
    private isClient: boolean = true;
    private serverReady: boolean = false;
    private initializePromise: Promise<void> | null = null;
    private initializeResolve: (() => void) | null = null;
    private requestTimeout: number = 30000;
    private retryCount: Map<string | number, number> = new Map();
    private pendingRetries: Map<string | number, NodeJS.Timeout> = new Map();
    private serverName: string;
    private checkInterval: NodeJS.Timeout | null = null;
    private maxBufferSize: number = 1024 * 1024; // 1MB max buffer size
    private lastActivityTimestamp: number = Date.now();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private connectionHealthCheckInterval: NodeJS.Timeout | null = null;
    private maxInactivityTime: number = 60000; // 60 seconds of inactivity before considering connection dead
    private maxRetries: number = 3;
    private retryDelay: number = 2000; // 2 seconds between retries
    private outputReader: ReadableStreamDefaultReader<string | Uint8Array> | null = null;
    private stderrReader: ReadableStreamDefaultReader<string | Uint8Array> | null = null;
    private isReading: boolean = false;
  
    constructor(serverProcess: ServerProcess, onServerReady?: () => void, serverName: string = 'unknown') {
      this.inputWriter = serverProcess.input.getWriter();
      this.onServerReady = onServerReady;
      this.serverName = serverName;
      
      // Set up a polling interval to check for new output
      this.checkInterval = setInterval(() => {
        this.checkForNewOutput();
      }, 250); // Check every 250ms
      
      // Set up a heartbeat to keep the connection alive
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, 15000); // Send heartbeat every 15 seconds
      
      // Set up a connection health check
      this.connectionHealthCheckInterval = setInterval(() => {
        this.checkConnectionHealth();
      }, 10000); // Check connection health every 10 seconds
  
      // Set up output reader - but don't lock the stream yet
      if (serverProcess.output && !this.isReading) {
        this.isReading = true;
        this.startReading(serverProcess);
      }
    }
  
    private async startReading(serverProcess: ServerProcess): Promise<void> {
      try {
        if (serverProcess.output) {
          this.outputReader = serverProcess.output.getReader();
          
          // Start reading in a separate async function
          this.readOutput();
        }
        
        if (serverProcess.stderr) {
          this.stderrReader = serverProcess.stderr.getReader();
          
          // Start reading stderr in a separate async function
          this.readStderr();
        }
      } catch (error) {
        addLogToTerminal(`Error setting up readers for ${this.serverName}: ${(error as Error).message}`, 'error');
        if (this.onerror) this.onerror(error as Error);
      }
    }
  
    private async readOutput(): Promise<void> {
      if (!this.outputReader) return;
      
      try {
        while (true) {
          const { value, done } = await this.outputReader.read();
          if (done) {
            addLogToTerminal(`Server process ${this.serverName} output stream ended`, 'warning');
            if (this.onclose) this.onclose();
            break;
          }
          
          if (value) {
            // Update last activity timestamp
            this.lastActivityTimestamp = Date.now();
            
            // Add to buffer
            this.buffer += value;
            
            // Check for server ready message in the raw output
            if (!this.serverReady && (
                this.buffer.includes('"method":"server/ready"') || 
                this.buffer.includes('Server: Ready') || 
                this.buffer.includes('Server started') || 
                this.buffer.includes('listening') ||
                this.buffer.includes('ready')
            )) {
              this.serverReady = true;
              if (this.onServerReady) {
                this.onServerReady();
              }
              if (this.initializeResolve) {
                this.initializeResolve();
                this.initializeResolve = null;
              }
              addLogToTerminal(`Detected server ready message for ${this.serverName}`, 'success');
            }
            
            // Process the buffer
            await this.processBuffer();
          }
        }
      } catch (error) {
        addLogToTerminal(`Output reader error for ${this.serverName}: ${(error as Error).message}`, 'error');
        if (this.onerror) this.onerror(error as Error);
      } finally {
        // Release the reader
        if (this.outputReader) {
          try {
            this.outputReader.releaseLock();
            this.outputReader = null;
          } catch (error) {
            addLogToTerminal(`Error releasing output reader: ${(error as Error).message}`, 'warning');
          }
        }
      }
    }
  
    private async readStderr(): Promise<void> {
      if (!this.stderrReader) return;
      
      try {
        while (true) {
          const { value, done } = await this.stderrReader.read();
          if (done) break;
          
          if (value) {
            addLogToTerminal(`Server ${this.serverName} stderr: ${value}`, 'warning');
          }
        }
      } catch (error) {
        addLogToTerminal(`Stderr reader error for ${this.serverName}: ${(error as Error).message}`, 'warning');
      } finally {
        // Release the reader
        if (this.stderrReader) {
          try {
            this.stderrReader.releaseLock();
            this.stderrReader = null;
          } catch (error) {
            addLogToTerminal(`Error releasing stderr reader: ${(error as Error).message}`, 'warning');
          }
        }
      }
    }
  
    // Send a heartbeat to keep the connection alive
    private async sendHeartbeat(): Promise<void> {
      try {
        if (this.isStarted && this.serverReady) {
          // Only send heartbeat if we haven't had activity in the last 10 seconds
          const currentTime = Date.now();
          if (currentTime - this.lastActivityTimestamp > 10000) {
            await this.send({
              jsonrpc: "2.0",
              method: "ping",
              params: {},
              id: `ping-${Date.now()}`
            });
          }
        }
      } catch (error) {
        // If heartbeat fails, report error but don't crash
        addLogToTerminal(`Heartbeat failed for server ${this.serverName}: ${(error as Error).message}`, 'warning');
      }
    }
    
    // Check connection health
    private checkConnectionHealth(): void {
      const currentTime = Date.now();
      const inactivityTime = currentTime - this.lastActivityTimestamp;
      
      // If we haven't had activity in a while, consider the connection dead
      if (inactivityTime > this.maxInactivityTime) {
        addLogToTerminal(`Connection to server ${this.serverName} appears to be dead (no activity for ${inactivityTime/1000} seconds)`, 'error');
        
        // Trigger error handler
        if (this.onerror) {
          this.onerror(new Error(`Connection timeout: No activity for ${inactivityTime/1000} seconds`));
        }
      }
    }
  
    private checkForNewOutput(): void {
      const data = processOutputData.get(this.serverName) || '';
      if (data && data !== this.buffer) {
        // Update last activity timestamp when we receive data
        this.lastActivityTimestamp = Date.now();
        
        // Process new data
        const newData = data.substring(this.buffer.length);
        this.buffer = data;
        
        // Check if buffer is getting too large and trim if needed
        if (this.buffer.length > this.maxBufferSize) {
          addLogToTerminal(`Buffer for server ${this.serverName} is too large (${this.buffer.length} bytes), trimming...`, 'warning');
          // Keep the last 100KB of data
          this.buffer = this.buffer.substring(this.buffer.length - 100 * 1024);
        }
        
        // Check for server ready message in the raw output
        if (!this.serverReady && (
            this.buffer.includes('"method":"server/ready"') || 
            this.buffer.includes('Server: Ready') || 
            this.buffer.includes('Server started') || 
            this.buffer.includes('listening') ||
            this.buffer.includes('ready')
        )) {
          this.serverReady = true;
          if (this.onServerReady) {
            this.onServerReady();
          }
          if (this.initializeResolve) {
            this.initializeResolve();
            this.initializeResolve = null;
          }
          addLogToTerminal(`Detected server ready message for ${this.serverName}`, 'success');
        }
        
        // Process the buffer
        this.processBuffer().catch(error => {
          if (this.onerror) {
            this.onerror(error instanceof Error ? error : new Error(String(error)));
          }
        });
      }
    }
  
    async processBuffer(): Promise<void> {
      // Split on newlines but handle potential partial messages
      let lines = this.buffer.split('\n');
      
      // Keep the last line in buffer if it's incomplete
      if (!lines[lines.length - 1].endsWith('}')) {
        this.buffer = lines.pop() || '';
      } else {
        this.buffer = '';
      }
  
      for (const line of lines) {
        if (!line.trim()) continue;
  
        try {
          // Handle non-JSON lines
          if (!line.includes('{') || !line.includes('}')) {
            addLogToTerminal(`Server log: ${line}`, 'info');
            
            // Check for server ready message in plain text
            if (!this.serverReady && (
                line.includes('Server: Ready') || 
                line.includes('Server started') || 
                line.includes(`${this.serverName} started`) ||
                line.includes('listening') ||
                line.includes('ready')
            )) {
              this.serverReady = true;
              if (this.onServerReady) {
                this.onServerReady();
              }
              if (this.initializeResolve) {
                this.initializeResolve();
                this.initializeResolve = null;
              }
              addLogToTerminal(`Detected server ready message for ${this.serverName}`, 'success');
            }
            continue;
          }
  
          // Try to extract JSON from the line
          const jsonMatch = line.match(/\{.*\}/);
          if (!jsonMatch) {
            addLogToTerminal(`Server log: ${line}`, 'info');
            continue;
          }
  
          // Try to parse the message
          let message: any;
          try {
            message = JSON.parse(jsonMatch[0]);
            addLogToTerminal(`Parsed message: ${message.method || 'response'}`, 'info');
          } catch (e) {
            addLogToTerminal(`Server log: ${line}`, 'info');
            continue;
          }
  
          // Handle server ready state
          if (!this.serverReady && (
              message.method === 'server/ready' || 
              message.result || 
              message.method === 'notifications/initialized'
          )) {
            this.serverReady = true;
            if (this.onServerReady) {
              this.onServerReady();
            }
            if (this.initializeResolve) {
              this.initializeResolve();
              this.initializeResolve = null;
            }
            addLogToTerminal(`Server ${this.serverName} is ready`, 'success');
          }
  
          // Handle responses
          if (message.result !== undefined || message.error !== undefined) {
            addLogToTerminal(`Server ${message.error ? 'error' : 'response'} for ID ${message.id}: ${JSON.stringify(message.error || message.result)}`, message.error ? 'error' : 'success');
            
            if (message.id !== undefined) {
              const request = this.pendingRequests.get(message.id);
              if (request) {
                addLogToTerminal(`Found matching request: ${request.message.method}`, 'success');
                
                // Clear any pending retries for this request
                const pendingRetry = this.pendingRetries.get(message.id);
                if (pendingRetry) {
                  clearTimeout(pendingRetry);
                  this.pendingRetries.delete(message.id);
                }
                
                this.pendingRequests.delete(message.id);
                this.retryCount.delete(message.id);
                
                if (this.onmessage) {
                  this.onmessage(message);
                }
              } else if (this.onmessage) {
                this.onmessage(message);
              }
            }
            continue;
          }
  
          // Handle echoed requests
          if (message.method && message.id !== undefined && this.pendingRequests.has(message.id)) {
            const request = this.pendingRequests.get(message.id);
            if (request && JSON.stringify(message) === JSON.stringify(request.message)) {
              addLogToTerminal(`Detected echoed request for ${message.method}`, 'info');
              
              // For resources/read and tools/call, retry if needed
              if (message.method === 'resources/read' || message.method === 'tools/call') {
                const retries = this.retryCount.get(message.id) || 0;
                if (retries < this.maxRetries) {
                  this.retryCount.set(message.id, retries + 1);
                  addLogToTerminal(`Will retry ${message.method} request (attempt ${retries + 1}) in ${this.retryDelay}ms`, 'info');
                  
                  // Clear any existing retry timeout
                  const existingRetry = this.pendingRetries.get(message.id);
                  if (existingRetry) {
                    clearTimeout(existingRetry);
                  }
                  
                  // Set new retry timeout
                  const retryTimeout = setTimeout(() => {
                    if (this.pendingRequests.has(message.id)) {
                      addLogToTerminal(`Retrying ${message.method} request now (attempt ${retries + 1})`, 'info');
                      this.send(request.message).catch(error => {
                        addLogToTerminal(`Error resending request: ${(error as Error).message}`, 'error');
                      });
                    }
                    this.pendingRetries.delete(message.id);
                  }, this.retryDelay);
                  
                  this.pendingRetries.set(message.id, retryTimeout);
                } else {
                  addLogToTerminal(`${message.method} request failed after ${retries} retries`, 'error');
                  
                  // Clear any pending retries
                  const pendingRetry = this.pendingRetries.get(message.id);
                  if (pendingRetry) {
                    clearTimeout(pendingRetry);
                    this.pendingRetries.delete(message.id);
                  }
                  
                  if (this.onmessage) {
                    this.onmessage({
                      id: message.id,
                      error: {
                        code: -32001,
                        message: `${message.method} request failed after ${retries} retries`
                      }
                    });
                  }
                  this.pendingRequests.delete(message.id);
                  this.retryCount.delete(message.id);
                }
              }
              continue;
            }
          }
  
          // For all other messages
          addLogToTerminal(`Server message: ${message.method || 'unknown'}`, 'info');
          
          if (this.onmessage) {
            this.onmessage(message);
          }
        } catch (error) {
          addLogToTerminal(`Error processing message: ${(error as Error).message}`, 'error');
        }
      }
  
      // Check for timeouts
      const now = Date.now();
      for (const [id, request] of this.pendingRequests.entries()) {
        const elapsed = now - request.timestamp;
        if (elapsed > this.requestTimeout) {
          addLogToTerminal(`Request ${id} (${request.message.method}) timed out after ${elapsed}ms`, 'error');
          
          // Clear any pending retries
          const pendingRetry = this.pendingRetries.get(id);
          if (pendingRetry) {
            clearTimeout(pendingRetry);
            this.pendingRetries.delete(id);
          }
          
          this.pendingRequests.delete(id);
          this.retryCount.delete(id);
          if (this.onmessage) {
            this.onmessage({
              id,
              error: {
                code: -32001,
                message: `Request timed out after ${elapsed}ms`
              }
            });
          }
        }
      }
    }
  
    async start(): Promise<void> {
      if (this.isStarted) {
        addLogToTerminal('Transport: Already started', 'info');
        return;
      }
  
      addLogToTerminal('Transport: Starting...', 'info');
      this.isStarted = true;
      
      this.initializePromise = new Promise<void>((resolve) => {
        this.initializeResolve = resolve;
        
        // Auto-resolve after timeout if server doesn't signal ready
        setTimeout(() => {
          if (!this.serverReady) {
            addLogToTerminal(`Auto-ready after timeout for server ${this.serverName}`, 'warning');
            this.serverReady = true;
            resolve();
          }
        }, 5000);
      });
    }
  
    async send(message: any): Promise<void> {
      // Update last activity timestamp when sending data
      this.lastActivityTimestamp = Date.now();
      
      // Only log non-ping/pong messages to reduce noise
      if (message.method && message.method !== 'ping' && message.method !== 'pong') {
        addLogToTerminal(`Sending message: ${message.method || 'response'}`, 'info');
      }
      
      if (!this.serverReady && message.method === 'initialize') {
        addLogToTerminal('Waiting for server ready before initialize...', 'info');
        try {
          const timeout = new Promise<void>((_, reject) => 
            setTimeout(() => reject(new Error('Server initialization timeout')), this.requestTimeout)
          );
          
          await Promise.race([
            this.initializePromise,
            timeout
          ]);
          
          addLogToTerminal('Server ready, sending initialize...', 'success');
        } catch (error) {
          addLogToTerminal(`Server initialization failed: ${(error as Error).message}`, 'error');
          throw error;
        }
      }
  
      const json = JSON.stringify(message) + '\n';
      
      if (this.isClient) {
        // Only log non-ping/pong messages
        if (message.method && message.method !== 'ping' && message.method !== 'pong') {
          addLogToTerminal(`Client -> Server: ${message.method || 'response'}`, 'info');
        }
        
        if (message.id !== undefined) {
          this.pendingRequests.set(message.id, {
            message,
            timestamp: Date.now()
          });
        }
      }
      
      try {
        await this.inputWriter.write(json);
      } catch (error) {
        addLogToTerminal(`Error writing to server: ${(error as Error).message}`, 'error');
        
        // If this is a critical error, trigger the error handler
        if (this.onerror) {
          this.onerror(error as Error);
        }
        
        throw error;
      }
    }
  
    async close(): Promise<void> {
      addLogToTerminal('Transport: Closing...', 'info');
      
      // Clear all intervals
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      
      if (this.connectionHealthCheckInterval) {
        clearInterval(this.connectionHealthCheckInterval);
        this.connectionHealthCheckInterval = null;
      }
      
      // Clear all pending retries
      for (const timeout of this.pendingRetries.values()) {
        clearTimeout(timeout);
      }
      this.pendingRetries.clear();
      
      // Release readers
      if (this.outputReader) {
        try {
          this.outputReader.releaseLock();
          this.outputReader = null;
        } catch (error) {
          addLogToTerminal(`Error releasing output reader: ${(error as Error).message}`, 'warning');
        }
      }
      
      if (this.stderrReader) {
        try {
          this.stderrReader.releaseLock();
          this.stderrReader = null;
        } catch (error) {
          addLogToTerminal(`Error releasing stderr reader: ${(error as Error).message}`, 'warning');
        }
      }
      
      // Release the writer
      try {
        await this.inputWriter.close();
      } catch (error) {
        addLogToTerminal(`Error closing writer: ${(error as Error).message}`, 'warning');
      }
      
      // Trigger onclose handler
      if (this.onclose) {
        this.onclose();
      }
    }
  
    get name(): string {
      return 'WebContainerStdioTransport';
    }
  
    get version(): string {
      return '1.0.0';
    }
  }