import React, { useEffect, useState, useRef, useContext } from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { WebContainerContext } from '../src/wmcp/providers/Webcontainer';
import { useWebContainer } from '../src/wmcp/hooks/useWebcontainer';
import { Tree, TreeItem, TreeItemContent } from '../src/Tree';
import Editor from '@monaco-editor/react';
import { FileSystemTree as WebContainerFileSystemTree } from '@webcontainer/api';
import {
  WebTerminal,
  ActionCard,
  FileBrowserToolbar,
  FileSystemTree,
  FileEditor,
  useFileOperations,
  ErrorDisplay,
  LoadingIndicator
} from '../src/wmcp/components';
import { ResizablePanel, ResizableHandle, ResizablePanelGroup } from '../src/Resizable';
import 'xterm/css/xterm.css';

const meta: Meta = {
  title: 'WebContainer/Examples',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

// Base component for all WebContainer stories
const WebContainerDemo = ({ 
  children,
  title,
  description
}: { 
  children: React.ReactNode,
  title: string,
  description: string 
}) => {
  const webContainer = useWebContainer();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (webContainer) {
      setIsReady(true);
    }
  }, [webContainer]);

  return (
    <div className="p-4 max-w-6xl mx-auto text-gray-200">
      <h1 className="text-2xl font-bold mb-2 text-gray-100">{title}</h1>
      <p className="mb-4 text-gray-400">{description}</p>
      
      {!isReady ? (
        <div className="animate-pulse bg-[#2d2d2d] p-4 rounded-md text-gray-300">
          Waiting for WebContainer to initialize...
        </div>
      ) : (
        <div className="border border-[#424242] rounded-md p-4 bg-[#1e1e1e]">
          {children}
        </div>
      )}
    </div>
  );
};

// Interface for file system entries
interface FSEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FSEntry[];
}

// Story 1: File System Operations with Tree View
export const FileSystem: Story = {
  render: () => {
    const webContainer = useWebContainer();
    const [message, setMessage] = useState('');
    const [fileTree, setFileTree] = useState<FSEntry[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [isDirectory, setIsDirectory] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [editorLanguage, setEditorLanguage] = useState<string>('plaintext');

    // File extension to language mapping for Monaco
    const getLanguageFromPath = (path: string): string => {
      const extension = path.split('.').pop()?.toLowerCase() || '';
      const languageMap: Record<string, string> = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown',
        'py': 'python',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'h': 'cpp',
        'go': 'go',
        'rs': 'rust',
        'sh': 'shell',
        'bash': 'shell',
        'txt': 'plaintext',
      };
      return languageMap[extension] || 'plaintext';
    };

    // Initialize the file system with some example files
    const initializeFileSystem = async () => {
      if (!webContainer) return;
      
      setIsLoading(true);
      setMessage('Initializing file system...');
      
      try {
        // Create some example files in different directories
        await webContainer.fs.mkdir('/src');
        await webContainer.fs.mkdir('/src/components');
        await webContainer.fs.mkdir('/src/styles');
        await webContainer.fs.mkdir('/public');
        
        // Create example files
        await webContainer.fs.writeFile('/src/index.js', `
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './styles/index.css';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
`);
        
        await webContainer.fs.writeFile('/src/App.js', `
import React from 'react';
import { Button } from './components/Button';
import './styles/App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>WebContainer File Browser Example</h1>
        <p>
          This is a demo application running in a WebContainer.
        </p>
        <Button onClick={() => alert('Button clicked!')}>
          Click me
        </Button>
      </header>
    </div>
  );
}

export default App;
`);
        
        await webContainer.fs.writeFile('/src/components/Button.js', `
import React from 'react';
import '../styles/Button.css';

export const Button = ({ children, onClick }) => {
  return (
    <button className="button" onClick={onClick}>
      {children}
    </button>
  );
};
`);
        
        await webContainer.fs.writeFile('/src/styles/index.css', `
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
`);
        
        await webContainer.fs.writeFile('/src/styles/App.css', `
.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: white;
}
`);
        
        await webContainer.fs.writeFile('/src/styles/Button.css', `
.button {
  background-color: #61dafb;
  border: none;
  color: #282c34;
  padding: 10px 20px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
  border-radius: 4px;
  font-weight: bold;
  transition: background-color 0.3s;
}

.button:hover {
  background-color: #21a1cb;
}
`);
        
        await webContainer.fs.writeFile('/public/index.html', `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WebContainer App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`);
        
        await webContainer.fs.writeFile('/README.md', `# WebContainer File Browser Demo

This is a demo project showing how to use the WebContainer API to create a file browser with code editing capabilities.

## Features

- Tree-based file navigation
- Monaco Editor integration for code viewing and editing
- Support for multiple file types

## Getting Started

1. Browse the file tree on the left
2. Click on a file to view its contents
3. Edit files directly in the editor
`);
        
        // Load the file tree after initialization
        await buildFileTree();
        setMessage('File system initialized with example files!');
      } catch (err) {
        setMessage(`Error initializing file system: ${err}`);
      } finally {
        setIsLoading(false);
      }
    };

    // Build file tree recursively from filesystem
    const buildFileTree = async (dir = '/') => {
      if (!webContainer) return;
      
      try {
        const entries = await webContainer.fs.readdir(dir, { withFileTypes: true });
        const result: FSEntry[] = [];
        
        for (const entry of entries) {
          const path = `${dir === '/' ? '' : dir}/${entry.name}`;
          
          if (entry.isDirectory()) {
            const children = await buildFileTree(path);
            result.push({
              name: entry.name,
              path,
              isDirectory: true,
              children
            });
          } else {
            result.push({
              name: entry.name,
              path,
              isDirectory: false
            });
          }
        }
        
        // Sort: directories first, then files, all alphabetically
        result.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        
        if (dir === '/') {
          setFileTree(result);
        }
        
        return result;
      } catch (err) {
        console.error(`Error reading directory ${dir}:`, err);
        return [];
      }
    };

    // Open a file
    const openFile = async (path: string) => {
      if (!webContainer) return;
      
      try {
        setIsLoading(true);
        
        // Check if it's a directory by trying to read it as a directory
        try {
          // If this succeeds, it's a directory
          await webContainer.fs.readdir(path);
          setIsDirectory(true);
          
          // If it's a directory, toggle expanded state
          setExpandedKeys(prev => 
            prev.includes(path) 
              ? prev.filter(key => key !== path) 
              : [...prev, path]
          );
        } catch (err) {
          // If reading as directory fails, assume it's a file
          setIsDirectory(false);
          
          // Read the file content
          const content = await webContainer.fs.readFile(path, 'utf-8');
          setFileContent(content);
          setCurrentFilePath(path);
          setEditorLanguage(getLanguageFromPath(path));
        }
      } catch (err) {
        setMessage(`Error opening ${path}: ${err}`);
      } finally {
        setIsLoading(false);
      }
    };

    // Save the current file
    const saveFile = async () => {
      if (!webContainer || !currentFilePath) return;
      
      try {
        await webContainer.fs.writeFile(currentFilePath, fileContent);
        setMessage(`File saved: ${currentFilePath}`);
      } catch (err) {
        setMessage(`Error saving file: ${err}`);
      }
    };

    // Create file tree items recursively
    const renderFileTree = (entries: FSEntry[]) => {
      return entries.map(entry => (
        <TreeItem 
          key={entry.path} 
          id={entry.path} 
          textValue={entry.name}
        >
          <TreeItemContent>
            <div className="flex items-center">
              {entry.isDirectory ? (
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              <span className={entry.isDirectory ? "font-medium" : ""}>{entry.name}</span>
            </div>
          </TreeItemContent>
          {entry.children && entry.children.length > 0 && renderFileTree(entry.children)}
        </TreeItem>
      ));
    };

    // Initialize on mount
    useEffect(() => {
      if (webContainer) {
        initializeFileSystem();
      }
    }, [webContainer]);

    // Handler for tree selection change
    const handleSelectionChange = (keys: any) => {
      // Convert the Selection type to array of strings
      const selectedKeysArray = Array.from(keys).map(key => String(key));
      setSelectedKeys(selectedKeysArray);
      
      if (selectedKeysArray.length > 0) {
        openFile(selectedKeysArray[selectedKeysArray.length - 1]);
      }
    };

    return (
      <WebContainerDemo 
        title="File Browser with Code Editor" 
        description="Browse the file system and edit code files with Monaco Editor."
      >
        <div className="space-y-4">
          <div className="flex space-x-2">
            <button 
              onClick={initializeFileSystem}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Reset Example Files'}
            </button>
            {currentFilePath && !isDirectory && (
              <button 
                onClick={saveFile}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Save File
              </button>
            )}
            <button 
              onClick={() => buildFileTree()}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              disabled={isLoading}
            >
              Refresh Tree
            </button>
          </div>
          
          {message && (
            <div className="bg-gray-100 dark:bg-zinc-800 p-3 rounded border">
              {message}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* File Tree */}
            <div className="border rounded-md bg-white p-2 h-[500px] overflow-auto">
              <h3 className="font-semibold mb-2 p-2 bg-gray-100 dark:bg-zinc-800 rounded sticky top-0">File Explorer</h3>
              {fileTree.length > 0 ? (
                <Tree 
                  aria-label="File System" 
                  selectionMode="single"
                  selectedKeys={selectedKeys}
                  onSelectionChange={handleSelectionChange}
                  expandedKeys={expandedKeys}
                  onExpandedChange={keys => setExpandedKeys(Array.from(keys).map(key => String(key)))}
                >
                  {renderFileTree(fileTree)}
                </Tree>
              ) : (
                <div className="flex justify-center items-center h-full text-gray-500">
                  No files found
                </div>
              )}
            </div>
            
            {/* File Content / Editor */}
            <div className="border rounded-md bg-white col-span-2 h-[500px] overflow-hidden flex flex-col">
              {currentFilePath ? (
                <>
                  <div className="bg-gray-100 dark:bg-zinc-800 p-2 flex justify-between items-center sticky top-0">
                    <h3 className="font-semibold">
                      {currentFilePath}
                    </h3>
                    <span className="text-xs px-2 py-1 bg-gray-200 rounded">
                      {editorLanguage}
                    </span>
                  </div>
                  
                  {isDirectory ? (
                    <div className="flex-1 flex justify-center items-center p-4 text-gray-500">
                      This is a directory. Select a file to view its contents.
                    </div>
                  ) : (
                    <div className="flex-1">
                      <Editor
                        height="100%"
                        defaultLanguage={editorLanguage}
                        language={editorLanguage}
                        value={fileContent}
                        onChange={(value) => setFileContent(value || '')}
                        theme="vs-light"
                        options={{
                          minimap: { enabled: false },
                          wordWrap: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex justify-center items-center p-4 text-gray-500">
                  Select a file from the explorer to view its contents.
                </div>
              )}
            </div>
          </div>
        </div>
      </WebContainerDemo>
    );
  }
};

// Story 2: Running Commands with Interactive Terminal
export const RunCommands: Story = {
  render: () => {
    const webContainer = useWebContainer();
    const [message, setMessage] = useState<string>('');

    const handleTerminalInitialized = () => {
      setMessage('Terminal initialized and ready for commands!');
    };

    const handleTerminalError = (error: any) => {
      setMessage(`Terminal error: ${error.message || String(error)}`);
    };

    return (
      <div className="border rounded-md p-4 bg-gray-100 dark:bg-zinc-800">
        <h3 className="font-semibold mb-4">Run Commands in WebContainer Terminal</h3>
        
        {message && (
          <div className="mb-4 p-2 bg-blue-50 text-blue-700 rounded text-sm border border-blue-200">
            {message}
          </div>
        )}
        
        <div className="border rounded-md overflow-hidden bg-black">
          <WebTerminal
            webContainer={webContainer}
            height={400}
            initialCommands={[
              'ls -la',
              'echo "Hello from WebContainer!"',
            ]}
            onInitialized={handleTerminalInitialized}
            onError={handleTerminalError}
          />
        </div>
      </div>
    );
  }
};

// Story 3: Simple Node.js App
export const NodeJsApp: Story = {
  render: () => {
    const webContainer = useWebContainer();
    const [output, setOutput] = useState('');
    const [appRunning, setAppRunning] = useState(false);
    const [serverUrl, setServerUrl] = useState('');
    
    const setupNodeApp = async () => {
      if (!webContainer) return;
      
      setOutput('Setting up Node.js app...\n');
      
      try {
        // Create package.json
        await webContainer.fs.writeFile('/package.json', JSON.stringify({
          name: 'simple-node-app',
          version: '1.0.0',
          description: 'A simple Node.js app running in WebContainer',
          main: 'index.js'
        }, null, 2));
        
        // Create a simple Express server with HTML response
        await webContainer.fs.writeFile('/index.js', `
const http = require('http');

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end(\`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WebContainer Node.js Server</title>
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          background-color: #f9fafb;
          color: #111827;
        }
        .container {
          background-color: white;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
          padding: 2rem;
        }
        h1 {
          color: #2563eb;
          margin-top: 0;
        }
        .info {
          background-color: #dbeafe;
          border-radius: 0.375rem;
          padding: 1rem;
          margin: 1rem 0;
        }
        .success {
          color: #059669;
          font-weight: bold;
        }
        .time {
          font-size: 0.875rem;
          color: #6b7280;
          margin-top: 2rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Hello from WebContainer!</h1>
        <p>This page is being served from a Node.js server running inside a WebContainer.</p>
        
        <div class="info">
          <p>WebContainers enable running Node.js directly in the browser.</p>
          <p class="success">✅ Server is up and running successfully!</p>
        </div>
        
        <p>Request path: \${req.url}</p>
        <p>Request method: \${req.method}</p>
        
        <p class="time">Current server time: \${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  \`);
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}/\`);
});

// Keep the server running
process.on('SIGTERM', () => {
  console.log('Server shutting down...');
  server.close(() => {
    console.log('Server closed');
  });
});
`);
        
        setOutput(prev => prev + 'Files created successfully.\n');
        
        // Start the server
        setOutput(prev => prev + 'Starting Node.js server...\n');
        const process = await webContainer.spawn('node', ['index.js']);
        
        // Handle server output
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              setOutput(prev => prev + data);
            }
          })
        );
        
        webContainer.on('server-ready', (port, url) => {
            setAppRunning(true);
            setServerUrl(url);
            setOutput(prev => prev + `Server URL: ${url}\n`);
          });
        
        // Clean up when component unmounts
        return () => {
          process.kill();
        };
      } catch (err) {
        setOutput(prev => prev + `\nError: ${err}\n`);
      }
    };

    return (
      <WebContainerDemo 
        title="Node.js Application" 
        description="Set up and run a simple Node.js application inside WebContainer."
      >
        <div className="space-y-4">
          <button 
            onClick={setupNodeApp}
            disabled={appRunning}
            className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 ${appRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {appRunning ? 'App Running' : 'Start Node.js App'}
          </button>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Console Output:</h3>
              <pre className="bg-black text-green-400 p-3 rounded border mt-2 h-64 overflow-auto whitespace-pre-wrap">{output || 'Click "Start Node.js App" to begin...'}</pre>
            </div>
            
            {appRunning && (
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Server Preview:</h3>
                <div className="mt-2 border rounded-md overflow-hidden h-64 bg-white">
                  {serverUrl ? (
                    <iframe 
                      src={serverUrl}
                      className="w-full h-full"
                      title="Node.js Server Preview"
                      sandbox="allow-same-origin allow-scripts"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-500">
                      <div className="text-center p-4">
                        <p className="font-medium mb-2 text-gray-800 dark:text-gray-200">Server is running at localhost:3000</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Preview not available in iframe due to WebContainer limitations</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {appRunning && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <h3 className="font-semibold text-blue-800 mb-2">About WebContainer Servers</h3>
              <p className="text-blue-700 text-sm">
                The Node.js server is running inside the WebContainer at <code className="bg-blue-100 px-1 py-0.5 rounded">localhost:3000</code>. 
                Due to the nature of WebContainers and browser security restrictions, the iframe preview might not be available in all environments.
              </p>
              <p className="text-blue-700 text-sm mt-2">
                In a full implementation, you would access this server through WebContainer's API methods.
              </p>
            </div>
          )}
        </div>
      </WebContainerDemo>
    );
  }
};

// Story 4: Shared File System Across Components
export const SharedFileSystem: Story = {
  render: () => {
    return (
      <WebContainerDemo
        title="Shared File System Across Components"
        description="This example shows how multiple components can contribute to the same WebContainer filesystem."
      >
        <div className="space-y-8">
          <div className="text-sm text-gray-500 bg-gray-100 dark:bg-zinc-800 p-4 rounded-md">
            <p>This example demonstrates how multiple components can contribute to the WebContainer filesystem.</p>
            <p>Each component below registers its own set of files, but they all share the same WebContainer instance.</p>
            <p>Changes made in one component are visible to all other components.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FileContributor 
              name="Frontend Component" 
              color="blue" 
              files={{
                '/frontend/index.html': {
                  file: {
                    contents: `<!DOCTYPE html>
<html>
<head>
  <title>Frontend Demo</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>`
                  }
                },
                '/frontend/styles.css': {
                  file: {
                    contents: `body {
  font-family: sans-serif;
  margin: 0;
  padding: 20px;
  background-color: #f5f5f5;
}

#app {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}`
                  }
                },
                '/frontend/app.js': {
                  file: {
                    contents: `// Frontend application code
document.getElementById('app').innerHTML = '<h1>Frontend App</h1><p>This content is loaded from app.js</p>';

// Try to import code from the backend
try {
  // This will work if the Backend Component is mounted
  const message = window.backendMessage || 'Backend component not loaded yet';
  document.getElementById('app').innerHTML += \`<div class="backend-message">\${message}</div>\`;
} catch (e) {
  console.error('Could not load backend code:', e);
}`
                  }
                },
                '/shared': {
                  directory: {}
                }
              }}
            />
            
            <FileContributor 
              name="Backend Component" 
              color="green"
              files={{
                '/backend/server.js': {
                  file: {
                    contents: `// Simple backend server code
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'Hello from the backend server!',
    endpoint: req.url
  }));
});

const PORT = 3000;
console.log(\`Server would start on port \${PORT}\`);

// Export a message that the frontend can use
if (typeof window !== 'undefined') {
  window.backendMessage = 'Message from backend component';
}`
                  }
                },
                '/backend/package.json': {
                  file: {
                    contents: `{
  "name": "backend-demo",
  "version": "1.0.0",
  "description": "Simple backend demo",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  }
}`
                  }
                },
                '/shared/config.json': {
                  file: {
                    contents: `{
  "appName": "Shared Filesystem Demo",
  "version": "1.0.0",
  "components": ["frontend", "backend"],
  "description": "This config file is shared between components"
}`
                  }
                }
              }}
            />
            
            <FileContributor 
              name="Utilities Component" 
              color="purple"
              files={{
                '/utils/helpers.js': {
                  file: {
                    contents: `// Utility functions
function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

module.exports = {
  formatDate,
  generateId
};`
                  }
                },
                '/utils/validation.js': {
                  file: {
                    contents: `// Validation utilities
function isEmail(email) {
  const re = /^[\\w-]+(\\.[\\w-]+)*@([\\w-]+\\.)+[a-zA-Z]{2,7}$/;
  return re.test(email);
}

function isRequired(value) {
  return value !== undefined && value !== null && value !== '';
}

module.exports = {
  isEmail,
  isRequired
};`
                  }
                },
                '/shared/README.md': {
                  file: {
                    contents: `# Shared Filesystem Demo

This project demonstrates how different components can contribute files to the same WebContainer filesystem.

## Structure

- \`/frontend\`: Contains the frontend code
- \`/backend\`: Contains the backend code
- \`/utils\`: Contains utility functions
- \`/shared\`: Contains files shared between components

## How it works

Each component registers its own filesystem tree, but they are all mounted in the same WebContainer instance.
This allows components to access files created by other components.`
                  }
                }
              }}
            />
          </div>
          
          <div className="w-full">
            <FileBrowser />
          </div>
        </div>
      </WebContainerDemo>
    );
  }
};

// Component that contributes files to the WebContainer
function FileContributor({ 
  name, 
  color, 
  files 
}: { 
  name: string;
  color: 'blue' | 'green' | 'red' | 'purple' | 'yellow';
  files: WebContainerFileSystemTree;
}) {
  const webContainer = useWebContainer(files);
  const [status, setStatus] = useState('Registering files...');
  const [mounted, setMounted] = useState(false);
  
  
  // Manual file creation as a fallback
  const createFilesManually = async () => {
    if (!webContainer) return;
    
    try {
      setStatus('Manually creating files...');
      
      // Create each file and directory manually
      for (const path of Object.keys(files)) {
        const entry = files[path];
        
        if ('file' in entry) {
          try {
            // Create parent directories if needed
            const parentDir = path.substring(0, path.lastIndexOf('/'));
            if (parentDir) {
              try {
                await webContainer.fs.mkdir(parentDir, { recursive: true });
              } catch (err) {
                // Ignore if directory already exists
                console.log(`${name}: Parent directory may already exist:`, parentDir);
              }
            }
            
            // Write the file
            // @ts-expect-error
            await webContainer.fs.writeFile(path, entry.file.contents);
            console.log(`${name}: Successfully wrote file manually: ${path}`);
          } catch (err) {
            console.error(`${name}: Failed to write file manually: ${path}`, err);
          }
        } else if ('directory' in entry) {
          try {
            await webContainer.fs.mkdir(path, { recursive: true });
            console.log(`${name}: Successfully created directory manually: ${path}`);
          } catch (err) {
            console.error(`${name}: Failed to create directory manually: ${path}`, err);
          }
        }
      }
      
      setMounted(true);
      setStatus('Files created manually!');
    } catch (err) {
      console.error(`${name}: Error creating files manually:`, err);
      setStatus('Error creating files manually');
    }
  };
  
  const colorClasses = {
    blue: 'bg-[#1e293b] border-[#2d3f63] text-blue-300',
    green: 'bg-[#1a2e1a] border-[#2d632d] text-green-300',
    red: 'bg-[#2e1a1a] border-[#632d2d] text-red-300',
    purple: 'bg-[#2e1a2e] border-[#632d63] text-purple-300',
    yellow: 'bg-[#2e2e1a] border-[#63632d] text-yellow-300'
  };
  
  return (
    <div className={`border rounded-md p-4 ${colorClasses[color]}`}>
      <h3 className="font-semibold mb-2">{name}</h3>
      <p className="text-sm mb-3 opacity-90">
        Status: {status}
        {mounted && (
          <span className="ml-1 inline-flex items-center">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </span>
        )}
      </p>
      
      <div className="flex justify-end mb-2">
        <button 
          onClick={createFilesManually}
          className="px-2 py-1 bg-[#0e639c] text-white text-xs rounded hover:bg-[#1177bb]"
        >
          Create Manually
        </button>
      </div>
      
      <div className="text-xs overflow-auto bg-[#2d2d2d] bg-opacity-50 p-3 rounded max-h-60">
        <p className="font-semibold mb-1">Contributed files:</p>
        <ul className="list-disc pl-5 space-y-1">
          {Object.keys(files).map(path => (
            <li key={path}>
              {path}
              {files[path].hasOwnProperty('directory') && ' (directory)'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FileBrowser() {
  const { filesystemIds, webContainer } = useContext(WebContainerContext);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<string[]>(['/']);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string>('');
  
  // Use our new file operations hook
  const {
    buildFileTree,
    loadFile,
    saveFile,
    error,
    isLoading: isFileOpLoading
  } = useFileOperations(webContainer);

  // State to hold the file tree
  const [fileTree, setFileTree] = useState<any[]>([]);

  // Load file tree when WebContainer is ready
  useEffect(() => {
    if (webContainer) {
      refreshFiles();
    }
  }, [webContainer]);

  // Refresh files
  const refreshFiles = async () => {
    setLoading(true);
    try {
      const tree = await buildFileTree();
      setFileTree(tree);
      
      // If no paths are expanded yet, expand the root
      if (!expandedPaths.includes('/')) {
        setExpandedPaths(['/']);
      }
    } catch (err) {
      console.error('Error building file tree:', err);
      setDebugMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelection = async (paths: string[]) => {
    setSelectedPaths(paths);
    
    if (paths.length > 0) {
      const path = paths[0];
      try {
        const content = await loadFile(path);
        setFileContent(content);
      } catch (err) {
        console.error(`Error loading file ${path}:`, err);
      }
    }
  };

  // Handle file save
  const handleSaveFile = async () => {
    if (selectedPaths.length > 0) {
      await saveFile(selectedPaths[0], fileContent);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* File Browser Panel */}
        <ActionCard 
          title="File Browser" 
          description={`${filesystemIds.length} filesystem(s) mounted`}
          fullHeight
          className="col-span-1"
        >
          <FileBrowserToolbar
            webContainer={webContainer}
            selectedPaths={selectedPaths}
            onRefresh={refreshFiles}
            isLoading={loading}
            onFileCreated={() => refreshFiles()}
            onDirectoryCreated={() => refreshFiles()}
            onDelete={() => refreshFiles()}
          />
          
          {loading ? (
            <LoadingIndicator message="Loading files..." variant="spinner" className="m-4" />
          ) : (
            <div className="p-2">
              <FileSystemTree
                files={fileTree}
                selectedPaths={selectedPaths}
                expandedPaths={expandedPaths}
                onSelectionChange={handleFileSelection}
                onExpandedChange={setExpandedPaths}
              />
            </div>
          )}
          
          {error && <ErrorDisplay error={error} className="m-2" />}
        </ActionCard>

        {/* File Editor Panel */}
        <ActionCard
          title={selectedPaths[0] || "File Editor"}
          description={selectedPaths.length ? "Edit file contents" : "Select a file to edit"}
          fullHeight
          className="col-span-1 md:col-span-2"
          actions={
            <div className="flex space-x-2">
              <button 
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                onClick={handleSaveFile}
                disabled={!selectedPaths.length || isFileOpLoading}
              >
                Save
              </button>
            </div>
          }
        >
          {selectedPaths.length > 0 ? (
            <FileEditor
              content={fileContent}
              onChange={setFileContent}
              path={selectedPaths[0]}
              height="500px"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Select a file from the browser to edit its contents
            </div>
          )}
        </ActionCard>
      </div>

      {/* Debug Information (if needed) */}
      {debugMessage && (
        <div className="border border-[#424242] rounded-md p-4 bg-[#2d2d2d]">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Debug Information</h3>
          <pre className="text-xs overflow-auto max-h-48 bg-[#1e1e1e] p-2 rounded text-gray-300">
            {debugMessage}
          </pre>
        </div>
      )}
    </div>
  );
}

// Story 5: VS Code-like Integrated Environment
export const IntegratedWebContainer: Story = {
  name: 'VS Code-like Integrated Environment',
  render: () => {
    const webContainer = useWebContainer();
    const [terminalMessage, setTerminalMessage] = useState<string>('');
    const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
    const [expandedPaths, setExpandedPaths] = useState<string[]>(['/']);
    const [fileContent, setFileContent] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const {
      buildFileTree,
      loadFile,
      saveFile,
      error,
      isLoading: isFileOpLoading
    } = useFileOperations(webContainer);

    const [fileTree, setFileTree] = useState<any[]>([]);

    useEffect(() => {
      if (webContainer) {
        refreshFiles();
      }
    }, [webContainer]);

    const refreshFiles = async () => {
      setLoading(true);
      try {
        const tree = await buildFileTree();
        setFileTree(tree);
        if (!expandedPaths.includes('/')) {
          setExpandedPaths(['/']);
        }
      } catch (err) {
        console.error('Error building file tree:', err);
      } finally {
        setLoading(false);
      }
    };

    const handleFileSelection = async (paths: string[]) => {
      setSelectedPaths(paths);
      if (paths.length > 0) {
        try {
          const content = await loadFile(paths[0]);
          setFileContent(content);
        } catch (err) {
          console.error(`Error loading file ${paths[0]}:`, err);
        }
      }
    };

    const handleSaveFile = async () => {
      if (selectedPaths.length > 0) {
        await saveFile(selectedPaths[0], fileContent);
      }
    };

    const handleTerminalInitialized = () => {
      setTerminalMessage('Terminal ready');
    };

    const handleTerminalError = (error: any) => {
      setTerminalMessage(`Error: ${error.message || String(error)}`);
    };

    return (
      <div className="h-screen w-full bg-[#1e1e1e] text-white overflow-hidden">
        <div className="h-6 bg-[#323233] flex items-center px-2 text-sm">
          <span className="text-gray-400">WebContainer IDE</span>
        </div>
        
        <ResizablePanelGroup direction="horizontal">
          {/* File Explorer Panel */}
          <ResizablePanel defaultSize={20} minSize={15}>
            <div className="h-full bg-[#252526] flex flex-col">
              <div className="p-2 text-sm font-medium border-b border-[#323233]">
                EXPLORER
              </div>
              <div className="flex-1 overflow-auto">
                <FileBrowserToolbar
                  webContainer={webContainer}
                  selectedPaths={selectedPaths}
                  onRefresh={refreshFiles}
                  isLoading={loading}
                  onFileCreated={refreshFiles}
                  onDirectoryCreated={refreshFiles}
                  onDelete={refreshFiles}
                  className="border-b border-[#323233] p-2"
                />
                {loading ? (
                  <LoadingIndicator message="Loading..." variant="spinner" className="m-4" />
                ) : (
                  <div className="p-2">
                    <FileSystemTree
                      files={fileTree}
                      selectedPaths={selectedPaths}
                      expandedPaths={expandedPaths}
                      onSelectionChange={handleFileSelection}
                      onExpandedChange={setExpandedPaths}
                    />
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Editor and Terminal Panel */}
          <ResizablePanel defaultSize={80}>
            <ResizablePanelGroup direction="vertical">
              {/* Editor Panel */}
              <ResizablePanel defaultSize={70}>
                <div className="h-full bg-[#1e1e1e] flex flex-col">
                  {selectedPaths.length > 0 ? (
                    <>
                      <div className="bg-[#2d2d2d] p-2 text-sm flex justify-between items-center">
                        <span>{selectedPaths[0]}</span>
                        <button
                          className="px-2 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded"
                          onClick={handleSaveFile}
                          disabled={isFileOpLoading}
                        >
                          Save
                        </button>
                      </div>
                      <div className="flex-1">
                        <FileEditor
                          content={fileContent}
                          onChange={setFileContent}
                          path={selectedPaths[0]}
                          height="100%"
                          theme="vs-dark"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      Select a file from the explorer to start editing
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Terminal Panel */}
              <ResizablePanel defaultSize={30}>
                <div className="h-full bg-[#1e1e1e] flex flex-col">
                  <div className="bg-[#2d2d2d] p-2 text-sm">
                    TERMINAL {terminalMessage && `- ${terminalMessage}`}
                  </div>
                  <div className="flex-1">
                    <WebTerminal
                      webContainer={webContainer}
                      height="100%"
                      initialCommands={[
                        'echo "Welcome to WebContainer Terminal"',
                        'ls -la'
                      ]}
                      onInitialized={handleTerminalInitialized}
                      onError={handleTerminalError}
                      className="h-full"
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }
};
