import React, { useState, useEffect } from 'react';

interface GridListProps<T> {
  'aria-label'?: string;
  items: T[];
  selectionMode: 'none' | 'single' | 'multiple';
  selectionBehavior?: 'replace' | 'toggle';
  selectedKeys: Set<string>;
  onSelectionChange: (selectedKeys: Set<string>) => void;
  onAction?: (key: string) => void;
  renderEmptyState?: () => React.ReactNode;
  children: (item: T) => React.ReactNode;
}

export function GridList<T extends { id: string }>({
  'aria-label': ariaLabel,
  items,
  selectionMode,
  selectionBehavior = 'toggle',
  selectedKeys,
  onSelectionChange,
  onAction,
  renderEmptyState,
  children
}: GridListProps<T>) {
  
  const handleItemClick = (item: T) => {
    if (selectionMode === 'none') {
      onAction?.(item.id);
    } else {
      const newSelectedKeys = new Set(selectedKeys);
      
      if (selectionMode === 'single') {
        if (selectedKeys.has(item.id)) {
          newSelectedKeys.delete(item.id);
        } else {
          newSelectedKeys.clear();
          newSelectedKeys.add(item.id);
        }
      } else if (selectionMode === 'multiple') {
        if (selectionBehavior === 'replace') {
          newSelectedKeys.clear();
          newSelectedKeys.add(item.id);
        } else {
          if (selectedKeys.has(item.id)) {
            newSelectedKeys.delete(item.id);
          } else {
            newSelectedKeys.add(item.id);
          }
        }
      }
      
      onSelectionChange(newSelectedKeys);
    }
  };
  
  if (items.length === 0 && renderEmptyState) {
    return <div className="grid-list empty" role="list" aria-label={ariaLabel}>{renderEmptyState()}</div>;
  }
  
  return (
    <div className="grid-list" role="list" aria-label={ariaLabel}>
      {items.map(item => (
        <div
          key={item.id}
          role="listitem"
          className={`grid-list-item ${selectedKeys.has(item.id) ? 'selected' : ''}`}
          onClick={() => handleItemClick(item)}
        >
          {children(item)}
        </div>
      ))}
    </div>
  );
} 