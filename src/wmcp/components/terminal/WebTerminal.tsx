import React, { useEffect, useRef, useState } from 'react';
import { Terminal, ITheme } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebContainer } from '@webcontainer/api';
import 'xterm/css/xterm.css';

export interface WebTerminalProps {
  /** The WebContainer instance to connect to */
  webContainer: WebContainer | null;
  /** Optional terminal options */
  terminalOptions?: {
    fontSize?: number;
    fontFamily?: string;
    theme?: ITheme;
    cursorBlink?: boolean;
  };
  /** Initial commands to run after terminal is ready */
  initialCommands?: string[];
  /** Callback when terminal is initialized */
  onInitialized?: () => void;
  /** Callback when there's an error */
  onError?: (error: Error) => void;
  /** Height of the terminal container */
  height?: string | number;
  /** Additional CSS class for the container */
  className?: string;
}

/**
 * A reusable terminal component that integrates with WebContainer
 */
export function WebTerminal({
  webContainer,
  terminalOptions,
  initialCommands = [],
  onInitialized,
  onError,
  height = '400px',
  className = ''
}: WebTerminalProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const shellProcessRef = useRef<any>(null);
  const initAttemptedRef = useRef(false);
  const inputWriterRef = useRef<WritableStreamDefaultWriter<string> | null>(null);

  // Initialize terminal and start shell
  const initializeTerminal = async () => {
    if (!webContainer || !terminalRef.current || isInitialized) {
      console.log('Cannot initialize terminal:', {
        hasWebContainer: !!webContainer,
        hasTerminalRef: !!terminalRef.current,
        isAlreadyInitialized: isInitialized
      });
      return;
    }
    
    // Mark that we've attempted initialization
    initAttemptedRef.current = true;
    
    try {
      console.log('Terminal initialization started');
      
      // Create terminal instance with default or custom options
      const terminal = new Terminal({
        cursorBlink: terminalOptions?.cursorBlink ?? true,
        fontSize: terminalOptions?.fontSize ?? 14,
        fontFamily: terminalOptions?.fontFamily ?? 'Menlo, monospace',
        theme: terminalOptions?.theme ?? {
          background: '#1e1e1e',
          foreground: '#f8f8f8',
          cursor: '#f8f8f8',
          black: '#000000',
          red: '#e06c75',
          green: '#98c379',
          yellow: '#e5c07b',
          blue: '#61afef',
          magenta: '#c678dd',
          cyan: '#56b6c2',
          white: '#d0d0d0'
        }
      });
      
      // Add fit addon
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      
      // Open terminal in the container
      terminal.open(terminalRef.current);
      fitAddon.fit();
      console.log('Terminal opened');
      
      // Start a shell
      let shellProcess = null;
      
      try {
        // Try jsh first (the shell used in the WebContainer examples)
        console.log('Trying to spawn jsh...');
        shellProcess = await webContainer.spawn('jsh', {
          terminal: {
            cols: terminal.cols,
            rows: terminal.rows
          }
        });
        console.log('Successfully spawned jsh');
      } catch (jshErr) {
        console.log('jsh not available, trying bash...', jshErr);
        try {
          // Fallback to bash
          shellProcess = await webContainer.spawn('bash', {
            terminal: {
              cols: terminal.cols,
              rows: terminal.rows
            }
          });
          console.log('Successfully spawned bash');
        } catch (bashErr) {
          console.log('bash not available, trying sh...', bashErr);
          try {
            // Last resort, try sh
            shellProcess = await webContainer.spawn('sh', {
              terminal: {
                cols: terminal.cols,
                rows: terminal.rows
              }
            });
            console.log('Successfully spawned sh');
          } catch (shErr) {
            console.error('All shell spawn attempts failed:', shErr);
            const error = new Error('Could not spawn any shell (jsh, bash, or sh)');
            if (onError) onError(error);
            throw error;
          }
        }
      }
      
      shellProcessRef.current = shellProcess;
      
      if (shellProcessRef.current) {
        // Pipe the shell output to the terminal
        shellProcessRef.current.output.pipeTo(
          new WritableStream({
            write(data) {
              terminal.write(data);
            }
          })
        );
        
        // Set up terminal input to write to shell
        const input = shellProcessRef.current.input.getWriter();
        inputWriterRef.current = input;
        
        terminal.onData((data) => {
          input.write(data);
        });
        
        // Handle window resize
        const handleResize = () => {
          fitAddon.fit();
          shellProcessRef.current?.resize({
            cols: terminal.cols,
            rows: terminal.rows
          });
        };
        
        window.addEventListener('resize', handleResize);
        
        // Save terminal instance for cleanup
        terminalInstanceRef.current = terminal;
        
        // Send initial commands if provided
        if (initialCommands.length > 0) {
          initialCommands.forEach(cmd => {
            input.write(`${cmd}\n`);
          });
        }
        
        setIsInitialized(true);
        if (onInitialized) onInitialized();
        console.log('Terminal fully initialized');
      } else {
        const error = new Error('Failed to start a shell process. No supported shell found.');
        if (onError) onError(error);
        console.error('Shell process failed to initialize');
      }
    } catch (err) {
      console.error('Terminal initialization error:', err);
      if (err instanceof Error && onError) {
        onError(err);
      }
    }
  };

  /**
   * Execute a command in the terminal
   */
  const executeCommand = (command: string) => {
    if (inputWriterRef.current && isInitialized) {
      inputWriterRef.current.write(`${command}\n`);
      return true;
    }
    return false;
  };

  // Expose executeCommand via a ref
  const terminalApi = {
    executeCommand
  };

  // Define a public method to get the terminal API
  (WebTerminal as any).getTerminalApi = () => terminalApi;
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (shellProcessRef.current) {
        console.log('Cleaning up shell process');
        shellProcessRef.current.kill();
      }
      if (terminalInstanceRef.current) {
        console.log('Disposing terminal instance');
        terminalInstanceRef.current.dispose();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Handle window resize
  const handleResize = () => {
    if (terminalInstanceRef.current) {
      const fitAddon = new FitAddon();
      terminalInstanceRef.current.loadAddon(fitAddon);
      fitAddon.fit();
      
      shellProcessRef.current?.resize({
        cols: terminalInstanceRef.current.cols,
        rows: terminalInstanceRef.current.rows
      });
    }
  };
  
  // Initialize terminal when webcontainer is ready
  useEffect(() => {
    if (webContainer && terminalRef.current && !isInitialized && !initAttemptedRef.current) {
      console.log('WebContainer available, attempting to initialize terminal');
      // Small delay to ensure the DOM is fully rendered
      const timer = setTimeout(() => {
        initializeTerminal();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [webContainer, isInitialized]);
  
  return (
    <div 
      className={`border rounded-md overflow-hidden bg-gray-900 ${className}`} 
      style={{ height }}
    >
      <div 
        ref={terminalRef} 
        className="h-full w-full"
      />
    </div>
  );
} 