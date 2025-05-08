import React, { useEffect, useRef, MutableRefObject } from "react";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { EditorState, StateField, Extension, StateEffect } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { closeBrackets, completionKeymap } from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import {
  highlightActiveLine,
  highlightActiveLineGutter,
  Decoration,
  DecorationSet
} from "@codemirror/view";
import { indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { bracketMatching } from "@codemirror/language";
import { foldGutter, foldKeymap } from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { getLanguages } from './languages';
import { lineNumbers } from '@codemirror/view';

// Define state effects for highlighting
export const clearHighlight = StateEffect.define<null>();
export const addHighlight = StateEffect.define<DecorationSet>();

// Define a state field for tracking highlights
const highlightField = StateField.define<DecorationSet>({
  create() { 
    return Decoration.none; 
  },
  update(value, tr) {
    value = value.map(tr.changes);
    
    // Check for our custom effects
    for (const e of tr.effects) {
      if (e.is(clearHighlight)) {
        return Decoration.none;
      }
      if (e.is(addHighlight)) {
        return e.value;
      }
    }
    return value;
  },
  provide: f => EditorView.decorations.from(f)
});

// CSS for debugger highlight (similar to DumbDebugger)
const debuggerTheme = EditorView.theme({
  ".cm-debugger-highlight": {
    backgroundColor: "rgba(0, 122, 204, 0.4) !important", // Blue highlight
    borderRadius: "2px"
  }
});

interface CodeMirrorEditorProps {
  initialContent: string;
  path: string;
  onChange?: (doc: string) => void;
  onReady?: (view: EditorView) => void;
  readOnly?: boolean;
  isUserEditingRef: MutableRefObject<boolean>;
  setIsUserEditing: (value: boolean) => void;
  userEditingTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
}

function getExtensions(path: string, readOnly = false): Extension[] {
  // Get language extensions based on file path
  const lang = getLanguages(path);
  
  const basicSetup = [
    // Basic editor features
    autocompletion(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    foldGutter(),
    lineNumbers(),
    // Add keymaps in this order
    keymap.of([
      ...defaultKeymap,
      ...completionKeymap,
      ...lintKeymap,
      ...foldKeymap,
      indentWithTab
    ]),
    
    // Theme
    vscodeDark,
    
    // Highlight field for debug highlighting
    highlightField,
    
    // Debugger theme
    debuggerTheme
  ];
  
  return [
    ...basicSetup,
    EditorView.theme({
      "&": { height: "100%" },
      ".cm-scroller": { overflow: "auto" },
      ".cm-content": { minHeight: "100%" },
    }),
    EditorView.lineWrapping,
    EditorView.editable.of(!readOnly),
    lang,
  ];
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  initialContent = "",
  path,
  onChange,
  onReady,
  readOnly = false,
  isUserEditingRef,
  setIsUserEditing,
  userEditingTimeoutRef
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const editorReadyReported = useRef(false);

  // Initialize editor when component mounts
  useEffect(() => {
    if (!editorRef.current) return;
    
    const userEditingTimeout = 1500; // ms to consider user done editing
    
    // Create the editor state
    const startState = EditorState.create({
      doc: initialContent,
      extensions: [
        ...getExtensions(path, readOnly),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged && onChange) {
            // Document has changed, so user is editing
            setIsUserEditing(true);
            isUserEditingRef.current = true;
            
            // Clear any existing timeout
            if (userEditingTimeoutRef.current) {
              clearTimeout(userEditingTimeoutRef.current);
            }
            
            // Start a new timeout - if no changes for userEditingTimeout ms, reset isUserEditing
            userEditingTimeoutRef.current = setTimeout(() => {
              setIsUserEditing(false);
              isUserEditingRef.current = false;
            }, userEditingTimeout);
            
            // Notify parent of content change
            onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    // Create the editor view
    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });
    
    // Store the view ref
    viewRef.current = view;
    
    // Report editor ready
    if (onReady && !editorReadyReported.current) {
      onReady(view);
      editorReadyReported.current = true;
    }

    return () => {
      // Cleanup: destroy view when component unmounts
      if (userEditingTimeoutRef.current) {
        clearTimeout(userEditingTimeoutRef.current);
      }
      view.destroy();
    };
  }, [
    path, 
    initialContent, 
    readOnly, 
    onChange, 
    onReady, 
    setIsUserEditing, 
    isUserEditingRef, 
    userEditingTimeoutRef
  ]);

  return <div ref={editorRef} className="h-full w-full" />;
};

export default CodeMirrorEditor;