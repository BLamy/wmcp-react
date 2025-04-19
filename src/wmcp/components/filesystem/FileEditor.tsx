import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';

/**
 * Props for the FileEditor component
 */
export interface FileEditorProps {
  /** File content to display in the editor */
  content: string;
  /** Handler for content changes */
  onChange?: (value: string) => void;
  /** File path or name (used for language detection) */
  path?: string;
  /** Explicitly set the language (overrides auto-detection from path) */
  language?: string;
  /** Whether the editor is in read-only mode */
  readOnly?: boolean;
  /** Height of the editor */
  height?: string | number;
  /** Callback when the editor is mounted */
  onMount?: OnMount;
  /** Theme to use for the editor */
  theme?: string;
  /** Optional additional CSS class names */
  className?: string;
  /** Key to force editor refresh */
  refreshKey?: number;
}

/**
 * A reusable component that wraps Monaco editor for code editing
 */
export function FileEditor({
  content,
  onChange,
  path,
  language,
  readOnly = false,
  height = '500px',
  onMount,
  theme = 'vs-dark',
  className = '',
  refreshKey = 0
}: FileEditorProps) {
  // Determine language from file extension if not explicitly provided
  const detectedLanguage = language || getLanguageFromPath(path || '');
  const editorRef = useRef<any>(null);

  // Handle content changes
  const handleEditorChange = (value: string | undefined) => {
    if (onChange && value !== undefined) {
      onChange(value);
    }
  };

  // Store editor reference on mount
  const handleEditorMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    
    // Setup TypeScript/JavaScript language features
    setupTypeScriptSupport(monaco);
    
    // Call the original onMount if provided
    if (onMount) {
      onMount(editor, monaco);
    }
  };

  // Force editor layout update when refreshKey changes
  useEffect(() => {
    if (editorRef.current) {
      // Small delay to ensure the layout update happens after any DOM changes
      setTimeout(() => {
        editorRef.current.layout();
      }, 50);
    }
  }, [refreshKey]);

  return (
    <div className={`overflow-hidden h-full ${className}`} key={refreshKey}>
      <Editor
        height={height}
        language={detectedLanguage}
        value={content}
        onChange={handleEditorChange}
        theme={theme}
        options={{
          readOnly,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true
        }}
        onMount={handleEditorMount}
      />
    </div>
  );
}

/**
 * Configure Monaco for TypeScript/JavaScript support
 */
function setupTypeScriptSupport(monaco: Monaco) {
  // Set compiler options for TypeScript
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: 'React',
    allowJs: true,
    typeRoots: ["node_modules/@types"]
  });

  // Same for JavaScript
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    target: monaco.languages.typescript.ScriptTarget.ES2020
  });
}

/**
 * Utility function to determine language from file path
 */
function getLanguageFromPath(path: string): string {
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
    'txt': 'plaintext'
  };

  return languageMap[extension] || 'plaintext';
} 