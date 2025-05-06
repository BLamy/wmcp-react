import React, { useRef, useEffect, useState } from 'react';
import {
  EditorState,
  StateEffect,
  StateField,
  Extension
} from "@codemirror/state";
import {
  EditorView,
  Decoration,
  DecorationSet
} from "@codemirror/view";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { cpp } from "@codemirror/lang-cpp";

// Import custom CSS for CodeMirror
import '@/components/WebcontainerCodeEditor/codemirror.css';

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
  onMount?: (view: EditorView) => void;
  /** Theme to use for the editor */
  theme?: string;
  /** Optional additional CSS class names */
  className?: string;
  /** Key to force editor refresh */
  refreshKey?: number;
}

// CodeMirror highlight setup
const clearHighlight = StateEffect.define();
const addHighlight = StateEffect.define<DecorationSet>();
const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(clearHighlight)) return Decoration.none;
      if (e.is(addHighlight)) return e.value;
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f),
});

// Create a VS Code dark theme extension for CodeMirror
const vscodeDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4'
  },
  '.cm-content': {
    caretColor: '#aeafad'
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#aeafad'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#264f78'
  },
  '.cm-panels': {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4'
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid #333'
  },
  '.cm-panels.cm-panels-bottom': {
    borderTop: '1px solid #333'
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(234, 92, 0, 0.33)',
    border: '1px solid rgba(234, 92, 0, 0.5)'
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(97, 153, 255, 0.33)'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(40, 40, 40, 0.7)'
  },
  '.cm-line': {
    lineHeight: '1.5'
  },
  '.cm-gutters': {
    backgroundColor: '#1e1e1e',
    color: '#858585',
    border: 'none'
  },
  '.cm-gutterElement': {
    padding: '0 6px 0 8px'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(40, 40, 40, 0.7)'
  }
});

/**
 * A reusable component that wraps CodeMirror editor for code editing
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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [previousContent, setPreviousContent] = useState(content);

  // Determine language from file extension if not explicitly provided
  const detectedLanguage = language || getLanguageFromPath(path || '');

  // Handle content changes from outside
  useEffect(() => {
    if (viewRef.current && content !== previousContent) {
      const currentView = viewRef.current;
      const currentText = currentView.state.doc.toString();
      
      if (content !== currentText) {
        currentView.dispatch({
          changes: {
            from: 0,
            to: currentText.length,
            insert: content
          }
        });
        setPreviousContent(content);
      }
    }
  }, [content, previousContent]);

  // Create and configure the editor
  useEffect(() => {
    if (!hostRef.current) return;
    
    // Get language extension based on detected language
    const langExtension = getLanguageExtension(detectedLanguage);
    
    // Theme selection based on provided theme
    const themeExtension = theme.includes('dark') ? [oneDark, vscodeDarkTheme] : [];
    
    // Setup the editor
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        const value = update.state.doc.toString();
        onChange(value);
        setPreviousContent(value);
      }
    });

    const extensions: Extension[] = [
      basicSetup,
      langExtension,
      ...themeExtension,
      highlightField,
      EditorView.editable.of(!readOnly),
      updateListener,
      EditorView.theme({
        "&": { height: typeof height === 'string' ? height : `${height}px` },
        ".cm-scroller": { overflow: "auto" }
      }),
    ];

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: content,
        extensions,
      }),
    });

    viewRef.current = view;
    
    if (onMount) {
      onMount(view);
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [detectedLanguage, theme, refreshKey, content, onChange, readOnly, height, onMount]); // Re-initialize when these props change

  // Force editor layout update when refreshKey changes
  useEffect(() => {
    if (viewRef.current) {
      // Make sure the editor is visible and sized correctly
      requestAnimationFrame(() => {
        const view = viewRef.current;
        if (view) {
          view.requestMeasure();
        }
      });
    }
  }, [refreshKey]);

  return (
    <div 
      ref={hostRef} 
      className={`h-full w-full overflow-hidden ${className}`} 
      style={{ height: typeof height === 'string' ? height : `${height}px` }}
    />
  );
}

/**
 * Get CodeMirror language extension based on language name
 */
function getLanguageExtension(language: string): Extension {
  switch (language.toLowerCase()) {
    case 'javascript':
      return javascript();
    case 'typescript':
      return javascript({ typescript: true });
    case 'jsx':
      return javascript({ jsx: true });
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'html':
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'markdown':
      return markdown();
    case 'python':
      return python();
    case 'rust':
      return rust();
    case 'c':
    case 'cpp':
      return cpp();
    default:
      return javascript(); // Fallback to JavaScript
  }
}

/**
 * Utility function to determine language from file path
 */
function getLanguageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
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