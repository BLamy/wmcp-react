import React, { useState, useEffect } from 'react';
import { GridList } from '../gridlist/GridList';

export interface ChatListProps {
  messages: { id: string, sender: string, date: string, subject: string, message: string }[];
  onMessageClick?: (messageId: string) => void;
  onMessageDelete?: (messageId: string) => void;
  selectedId?: string;
}

export function ChatList({ messages, onMessageClick, onMessageDelete, selectedId }: ChatListProps) {
  const [localMessages, setLocalMessages] = useState(messages);
  const [selectionMode, setSelectionMode] = useState<'none' | 'single' | 'multiple'>('none');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalMessages(messages);
    
    // Set initial selection if selectedId is provided
    if (selectedId && !selectedKeys.has(selectedId)) {
      setSelectedKeys(new Set([selectedId]));
    }
  }, [messages, selectedId]);

  const handleDelete = () => {
    if (onMessageDelete) {
      if (selectedKeys.size > 0) {
        // Delete selected messages
        if (selectedKeys.size === localMessages.length) {
          // All messages are selected, delete them all
          localMessages.forEach(message => onMessageDelete(message.id));
        } else {
          // Delete only selected messages
          selectedKeys.forEach(key => onMessageDelete(key));
        }
        
        // Reset selection
        setSelectedKeys(new Set());
        setSelectionMode('none');
      }
    }
  };

  const handleMessageClick = (messageId: string) => {
    console.log('Message clicked in ChatList:', messageId);
    if (onMessageClick) {
      console.log('Calling onMessageClick callback with message ID:', messageId);
      onMessageClick(messageId);
      // Update selected key
      setSelectedKeys(new Set([messageId]));
      console.log('Updated selected keys:', messageId);
    } else {
      console.warn('No onMessageClick handler provided');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="font-medium">{localMessages.length} Conversations</span>
        {selectionMode === 'none' ? (
          <button 
            className="text-sm text-blue-600 hover:text-blue-800"
            onClick={() => setSelectionMode('multiple')}
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button 
              className="text-sm text-red-600 hover:text-red-800"
              onClick={handleDelete}
            >
              Delete
            </button>
            <button 
              className="text-sm text-gray-600 hover:text-gray-800"
              onClick={() => {
                setSelectionMode('none');
                setSelectedKeys(new Set());
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      
      <div className="overflow-y-auto flex-1">
        <GridList
          aria-label="Chat messages"
          items={localMessages}
          selectionMode={selectionMode}
          selectionBehavior="replace"
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onAction={(key) => {
            if (selectionMode === 'none') {
              handleMessageClick(key.toString());
            }
          }}
          renderEmptyState={() => <div className="py-8 text-center text-gray-500">No messages</div>}
        >
          {message => (
            <div 
              className={`px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 ${
                selectedKeys.has(message.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
              }`}
              key={message.id}
              onClick={() => selectionMode === 'none' && handleMessageClick(message.id)}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold">{message.sender}</span>
                <span className="text-xs text-gray-500">{message.date}</span>
              </div>
              <div className="font-medium">{message.subject}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{message.message}</div>
              {selectionMode === 'none' && (
                <div className="flex justify-end mt-2">
                  <button 
                    className="text-xs text-red-600 hover:text-red-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onMessageDelete) {
                        onMessageDelete(message.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </GridList>
      </div>
    </div>
  );
}
