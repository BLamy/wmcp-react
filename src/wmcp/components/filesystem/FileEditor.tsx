import React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

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
  className = ''
}: FileEditorProps) {
  // Determine language from file extension if not explicitly provided
  const detectedLanguage = language || getLanguageFromPath(path || '');

  // Handle content changes
  const handleEditorChange = (value: string | undefined) => {
    if (onChange && value !== undefined) {
      onChange(value);
    }
  };

  return (
    <div className={`border rounded-md overflow-hidden h-full ${className}`}>
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
        onMount={onMount}
      />
    </div>
  );
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