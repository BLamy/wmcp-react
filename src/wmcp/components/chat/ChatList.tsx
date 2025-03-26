import React, { useState, useRef } from 'react';
import { GridList, GridListItem } from 'react-aria-components';
import { Button } from '@/components/aria/Button';
import type { Selection, SelectionMode, Key } from 'react-aria-components';
import { animate, AnimatePresence, motion, useIsPresent, useMotionTemplate, useMotionValue, useMotionValueEvent } from 'framer-motion';
import type { CSSProperties } from 'react';

export interface ChatListProps {
  messages: { id: string, sender: string, date: string, subject: string, message: string }[];
  onMessageClick?: (messageId: string) => void;
  onMessageDelete?: (messageId: string) => void;
  selectedId?: string;
}

const MotionItem = motion(GridListItem);
const inertiaTransition = {
  type: 'inertia' as const,
  bounceStiffness: 300,
  bounceDamping: 40,
  timeConstant: 300
};

export function ChatList({ messages, onMessageClick, onMessageDelete, selectedId }: ChatListProps) {
  const [localMessages, setLocalMessages] = useState(messages);
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set(selectedId ? [selectedId] : []));
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');

  React.useEffect(() => {
    setLocalMessages(messages);
    
    // Set initial selection if selectedId is provided
    if (selectedId) {
      setSelectedKeys(new Set([selectedId]));
    }
  }, [messages, selectedId]);

  const onDelete = () => {
    if (onMessageDelete) {
      if (selectedKeys !== 'all' && selectedKeys.size > 0) {
        // Delete selected messages
        selectedKeys.forEach(key => onMessageDelete(key.toString()));
        
        // Update local messages
        setLocalMessages(
          localMessages.filter((item) => {
            // This checks if the item's ID is in the selectedKeys set
            if (selectedKeys === 'all') return false;
            const keySet = selectedKeys as Set<React.Key>;
            return !keySet.has(item.id);
          })
        );
      }
    }
    
    // Reset selection
    setSelectedKeys(new Set());
    setSelectionMode('none');
  };

  const handleAction = (key: React.Key) => {
    if (selectionMode === 'none' && onMessageClick) {
      onMessageClick(key.toString());
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="flex pb-4 justify-between items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700 w-full">
        <span className="font-medium">{localMessages.length} Conversations</span>
        <div className="flex">
          <Button
            variant="destructive"
            className="text-xs px-2 py-1 ml-1"
            style={{ opacity: selectionMode === 'none' ? 0 : 1 }}
            isDisabled={selectedKeys !== 'all' && selectedKeys.size === 0}
            onPress={onDelete}
          >
            Delete
          </Button>
          <Button
            variant="secondary"
            className="text-xs px-2 py-1 ml-1"
            onPress={() => {
              setSelectionMode((m) => (m === 'none' ? 'multiple' : 'none'));
              setSelectedKeys(new Set());
            }}
          >
            {selectionMode === 'none' ? 'Edit' : 'Cancel'}
          </Button>
        </div>
      </div>
      
      <GridList
        className="relative flex-1 overflow-auto w-full"
        aria-label="Chat messages"
        onAction={selectionMode === 'none' ? handleAction : undefined}
        selectionMode={selectionMode}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
      >
        <AnimatePresence>
          {localMessages.map((item) => (
            <ListItem
              key={item.id}
              id={item.id}
              textValue={[item.sender, item.date, item.subject, item.message].join('\n')}
              onRemove={() => {
                if (onMessageDelete) {
                  onMessageDelete(item.id);
                }
                setLocalMessages(localMessages.filter((i) => i.id !== item.id));
              }}
            >
              <div className="flex flex-col text-md cursor-default w-full">
                <div className="flex justify-between w-full">
                  <p className="font-semibold text-lg m-0">{item.sender}</p>
                  <p className="text-gray-500 m-0">{item.date}</p>
                </div>
                <p className="font-medium m-0">{item.subject}</p>
                <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400 m-0">
                  {item.message}
                </p>
              </div>
            </ListItem>
          ))}
        </AnimatePresence>
      </GridList>
    </div>
  );
}

interface ListItemProps {
  id: string;
  children: React.ReactNode;
  textValue: string;
  onRemove: () => void;
}

function ListItem({ id, children, textValue, onRemove }: ListItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const isPresent = useIsPresent();
  const xPx = useMotionTemplate`${x}px`;

  // Align the text in the remove button to the left if the
  // user has swiped at least 80% of the width.
  const [align, setAlign] = useState('end');
  useMotionValueEvent(x, 'change', (xValue) => {
    if (ref.current) {
      const a = xValue < -ref.current.offsetWidth * 0.8 ? 'start' : 'end';
      setAlign(a);
    }
  });

  return (
    <MotionItem
      id={id}
      textValue={textValue}
      className="outline-hidden group relative overflow-clip border-t border-0 border-solid last:border-b border-gray-200 dark:border-gray-800 pressed:bg-gray-200 dark:pressed:bg-gray-800 selected:bg-gray-200 dark:selected:bg-gray-800 focus-visible:outline focus-visible:outline-blue-600 focus-visible:-outline-offset-2 w-full"
      layout
      transition={{ duration: 0.25 }}
      exit={{ opacity: 0 }}
      // Take item out of the flow if it is being removed.
      style={{ position: isPresent ? 'relative' : 'absolute', width: '100%' }}
    >
      {({ selectionMode, isSelected }) => (
        // Content of the item can be swiped to reveal the delete button, or fully swiped to delete.
        <motion.div
          ref={ref}
          style={{ x, '--x': xPx } as CSSProperties}
          className="flex items-center w-full"
          drag={selectionMode === 'none' ? 'x' : undefined}
          dragConstraints={{ right: 0 }}
          onDragEnd={(e, { offset }) => {
            // If the user dragged past 80% of the width, remove the item
            // otherwise animate back to the nearest snap point.
            let v = offset.x > -20 ? 0 : -100;
            if (ref.current && x.get() < -ref.current.offsetWidth * 0.8) {
              v = -ref.current.offsetWidth;
              onRemove();
            }
            animate(x, v, { ...inertiaTransition, min: v, max: v });
          }}
          onDragStart={() => {
            // Cancel react-aria press event when dragging starts.
            document.dispatchEvent(new PointerEvent('pointercancel'));
          }}
        >
          {selectionMode === 'multiple' && (
            <SelectionCheckmark isSelected={isSelected} />
          )}
          <motion.div
            layout
            layoutDependency={selectionMode}
            transition={{ duration: 0.25 }}
            className="relative flex items-center px-4 py-2 z-10 w-full"
          >
            {children}
          </motion.div>
          {selectionMode === 'none' && (
            <Button
              variant="destructive"
              className="absolute top-0 left-[100%] py-2 h-full z-0 isolate"
              style={{
                // Calculate the size of the button based on the drag position,
                // which is stored in a CSS variable above.
                width: 'max(100px, calc(-1 * var(--x)))',
                justifyContent: align
              }}
              onPress={onRemove}
              // Move the button into view when it is focused with the keyboard
              // (e.g. via the arrow keys).
              onFocus={() => x.set(-100)}
              onBlur={() => x.set(0)}
            >
              <motion.span
                initial={false}
                className="px-4"
                animate={{
                  // Whenever the alignment changes, perform a keyframe animation
                  // between the previous position and new position. This is done
                  // by calculating a transform for the previous alignment and
                  // animating it back to zero.
                  transform: align === 'start'
                    ? ['translateX(calc(-100% - var(--x)))', 'translateX(0)']
                    : ['translateX(calc(100% + var(--x)))', 'translateX(0)']
                }}
              >
                Delete
              </motion.span>
            </Button>
          )}
        </motion.div>
      )}
    </MotionItem>
  );
}

interface SelectionCheckmarkProps {
  isSelected: boolean;
}

function SelectionCheckmark({ isSelected }: SelectionCheckmarkProps) {
  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-6 h-6 shrink-0 ml-4"
      initial={{ x: -40 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.25 }}
    >
      {!isSelected && (
        <circle
          r={9}
          cx={12}
          cy={12}
          stroke="currentColor"
          fill="none"
          strokeWidth={1}
          className="text-gray-400"
        />
      )}
      {isSelected && (
        <path
          className="text-blue-600"
          fillRule="evenodd"
          d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
          clipRule="evenodd"
        />
      )}
    </motion.svg>
  );
}
