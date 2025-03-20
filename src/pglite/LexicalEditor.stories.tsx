import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { LexicalEditor } from './LexicalEditor';

// Define metadata for the stories
const meta: Meta<typeof LexicalEditor> = {
  title: 'PGlite/Lexical Editor',
  component: LexicalEditor,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    readOnly: {
      control: 'boolean',
      description: 'Whether the editor is in read-only mode',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text to display when the editor is empty',
    },
    className: {
      control: 'text',
      description: 'Additional CSS class names',
    },
  },
};

export default meta;
type Story = StoryObj<typeof LexicalEditor>;

// Basic Lexical editor
export const Basic: Story = {
  name: 'Basic Editor',
  render: () => (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <LexicalEditor placeholder="Write something..." />
    </div>
  ),
};

// Read-only editor with content
export const ReadOnly: Story = {
  name: 'Read-Only Editor',
  render: () => (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <LexicalEditor 
        readOnly={true} 
        placeholder="This editor is read-only"
      />
    </div>
  ),
};

// Editor with custom placeholder
export const CustomPlaceholder: Story = {
  name: 'Custom Placeholder',
  render: () => (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <LexicalEditor 
        placeholder="Start typing your task description here..."
      />
    </div>
  ),
};

// Editor with a custom CSS class
export const CustomStyle: Story = {
  name: 'Custom Styled Editor',
  render: () => (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <style>
        {`
          .custom-editor {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .custom-editor .editor-inner {
            background-color: #f9fafb;
          }
          .custom-editor .editor-input {
            font-family: 'Georgia', serif;
          }
        `}
      </style>
      <LexicalEditor 
        className="custom-editor"
        placeholder="This editor has custom styling"
      />
    </div>
  ),
};

// Integration example in a form
export const IntegrationExample: Story = {
  name: 'Integration in Form',
  render: () => (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <form 
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          backgroundColor: 'white',
        }}
        onSubmit={(e) => e.preventDefault()}
      >
        <h2 style={{ margin: '0 0 16px 0' }}>Create New Task</h2>
        
        <div>
          <label 
            htmlFor="title"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
            }}
          >
            Task Title
          </label>
          <input
            id="title"
            type="text"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
            placeholder="Enter task title"
          />
        </div>
        
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
            }}
          >
            Task Description
          </label>
          <LexicalEditor 
            placeholder="Enter a detailed description of this task..."
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '8px' }}>
          <div>
            <label 
              htmlFor="priority"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
              }}
            >
              Priority
            </label>
            <select
              id="priority"
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          
          <div>
            <label 
              htmlFor="status"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
              }}
            >
              Status
            </label>
            <select
              id="status"
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="backlog">Backlog</option>
              <option value="todo" selected>Todo</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button 
            type="button" 
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Create Task
          </button>
        </div>
      </form>
    </div>
  ),
}; 