import React, { useEffect, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { $getRoot, $createParagraphNode, $createTextNode, EditorState, SerializedEditorState } from 'lexical';
import ToolbarPlugin from './plugins/ToolbarPlugin';
import './LexicalEditor.css';

// Define theme
const theme = {
  // Theme styling goes here...
  paragraph: 'editor-paragraph',
  text: {
    bold: 'editor-text-bold',
    italic: 'editor-text-italic',
    underline: 'editor-text-underline',
    code: 'editor-text-code',
  },
  heading: {
    h1: 'editor-heading-h1',
    h2: 'editor-heading-h2',
    h3: 'editor-heading-h3',
  },
};

// Define nodes
const nodes = [
  HeadingNode,
  ListNode,
  ListItemNode,
  QuoteNode,
  CodeNode,
  CodeHighlightNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  AutoLinkNode,
  LinkNode,
];

function onError(error: Error) {
  console.error(error);
}

type LexicalEditorProps = {
  /** Initial content for the editor */
  initialContent?: string;
  /** Callback for when content changes */
  onChange?: (content: string) => void;
  /** Whether the editor is in read-only mode */
  readOnly?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Optional additional CSS class names */
  className?: string;
};

/**
 * A rich text editor component using Lexical
 */
export function LexicalEditor({
  initialContent = '',
  onChange,
  readOnly = false,
  placeholder = 'Enter some text...',
  className = '',
}: LexicalEditorProps) {
  const initialConfig = {
    namespace: 'WMCPEditor',
    theme,
    nodes,
    onError,
    editable: !readOnly,
  };

  // Handle changes to the editor
  const handleEditorChange = (editorState: EditorState) => {
    editorState.read(() => {
      try {
        // Serialize the editor state to JSON
        const jsonString = JSON.stringify(editorState.toJSON());
        onChange?.(jsonString);
      } catch (error) {
        console.error('Error serializing editor content:', error);
      }
    });
  };

  // Initialize editor with content if provided
  const prepopulatedContent = () => {
    if (!initialContent) return null;
    
    try {
      // Check if it's already a parsed object (for backward compatibility)
      const contentObj = typeof initialContent === 'string'
        ? JSON.parse(initialContent)
        : initialContent;
        
      if (!contentObj || typeof contentObj !== 'object') {
        console.warn('Invalid editor content format', contentObj);
        return null;
      }
      
      // Return a function that provides the editor state
      return () => {
        // Create at least one paragraph node if the content is empty
        const root = $getRoot();
        if (root.getChildrenSize() === 0) {
          root.append($createParagraphNode());
        }
        
        // Return the parsed state
        return contentObj;
      };
    } catch (error) {
      console.warn('Failed to parse editor content:', error);
      
      // If it's not valid JSON, just return the string as plain text content
      return () => {
        const root = $getRoot();
        const paragraph = $createParagraphNode();
        
        // Create text node with the content
        const textNode = $createTextNode(initialContent);
        paragraph.append(textNode);
        
        root.append(paragraph);
      };
    }
  };

  return (
    <div className={`lexical-editor-container ${className}`}>
      <LexicalComposer initialConfig={{
        ...initialConfig,
        editorState: prepopulatedContent(),
      }}>
        <div className="editor-inner">
          {!readOnly && <ToolbarPlugin />}
          <div className="editor-content">
            <RichTextPlugin
              contentEditable={<ContentEditable className="editor-input" />}
              placeholder={<div className="editor-placeholder">{placeholder}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            {!readOnly && <AutoFocusPlugin />}
            <ListPlugin />
            <LinkPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <OnChangePlugin onChange={handleEditorChange} />
          </div>
        </div>
      </LexicalComposer>
    </div>
  );
}

export default LexicalEditor; 