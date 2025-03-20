import React from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  FORMAT_ELEMENT_COMMAND, 
  FORMAT_TEXT_COMMAND, 
  UNDO_COMMAND, 
  REDO_COMMAND,
  $getSelection,
  $isRangeSelection
} from 'lexical';
import { 
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND
} from '@lexical/list';
import { 
  $createHeadingNode, 
  $createQuoteNode, 
  $isHeadingNode,
  HeadingTagType
} from '@lexical/rich-text';
import { $wrapNodes } from '@lexical/selection';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';

const ToolbarPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const [isEditorEmpty, setIsEditorEmpty] = React.useState(true);
  const [isBold, setIsBold] = React.useState(false);
  const [isItalic, setIsItalic] = React.useState(false);
  const [isUnderline, setIsUnderline] = React.useState(false);
  
  // Common button styles
  const buttonStyle = {
    padding: '8px',
    margin: '0 2px',
    backgroundColor: 'transparent',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  };
  
  const activeButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#e5e7eb',
    borderColor: '#9ca3af',
  };
  
  // Format text in bold
  const formatBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  };

  // Format text in italic
  const formatItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  };

  // Format text with underline
  const formatUnderline = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
  };

  // Format as heading (h1, h2, h3)
  const formatHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if (selection && $isRangeSelection(selection)) {
        $wrapNodes(selection, () => $createHeadingNode(headingSize));
      }
    });
  };

  // Create a bulleted list
  const formatBulletList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  };

  // Create a numbered list
  const formatNumberedList = () => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };

  // Create a quote block
  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (selection && $isRangeSelection(selection)) {
        $wrapNodes(selection, () => $createQuoteNode());
      }
    });
  };

  // Undo the last edit
  const undo = () => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  };

  // Redo the last undone edit
  const redo = () => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  };
  
  // Use React's useEffect to add listeners that update button states
  React.useEffect(() => {
    const updateToolbar = () => {
      const selection = $getSelection();
      
      // Update text format states (bold, italic, etc.)
      if (selection && $isRangeSelection(selection)) {
        // Check if selection has the given format
        setIsBold(selection.hasFormat('bold'));
        setIsItalic(selection.hasFormat('italic'));
        setIsUnderline(selection.hasFormat('underline'));
      }
    };
    
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      })
    );
  }, [editor]);

  return (
    <div className="toolbar" style={{
      marginBottom: '8px',
      padding: '8px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px'
    }}>
      <button
        onClick={undo}
        title="Undo"
        style={buttonStyle}
      >
        Undo
      </button>
      <button
        onClick={redo}
        title="Redo"
        style={buttonStyle}
      >
        Redo
      </button>
      <span style={{ width: '1px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
      <button
        onClick={formatBold}
        title="Bold"
        style={isBold ? activeButtonStyle : buttonStyle}
      >
        B
      </button>
      <button
        onClick={formatItalic}
        title="Italic"
        style={isItalic ? activeButtonStyle : buttonStyle}
      >
        I
      </button>
      <button
        onClick={formatUnderline}
        title="Underline"
        style={isUnderline ? activeButtonStyle : buttonStyle}
      >
        U
      </button>
      <span style={{ width: '1px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
      <button
        onClick={() => formatHeading('h1')}
        title="Heading 1"
        style={buttonStyle}
      >
        H1
      </button>
      <button
        onClick={() => formatHeading('h2')}
        title="Heading 2"
        style={buttonStyle}
      >
        H2
      </button>
      <button
        onClick={formatQuote}
        title="Quote"
        style={buttonStyle}
      >
        Quote
      </button>
      <span style={{ width: '1px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
      <button
        onClick={formatBulletList}
        title="Bullet List"
        style={buttonStyle}
      >
        • List
      </button>
      <button
        onClick={formatNumberedList}
        title="Numbered List"
        style={buttonStyle}
      >
        1. List
      </button>
    </div>
  );
};

export default ToolbarPlugin; 