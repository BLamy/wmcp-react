import React, { ReactNode } from 'react';

export interface ActionCardProps {
  /** Title of the card */
  title: string;
  /** Optional description text */
  description?: string;
  /** Main content */
  children: ReactNode;
  /** Footer actions (usually buttons) */
  actions?: ReactNode;
  /** Optional icon to display next to the title */
  icon?: ReactNode;
  /** Whether the card is currently in a loading state */
  isLoading?: boolean;
  /** Whether the card is currently in an error state */
  hasError?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Optional header actions (e.g., menu, close button) */
  headerActions?: ReactNode;
  /** Whether the card should take up the full height of its container */
  fullHeight?: boolean;
  /** Card width style */
  width?: string;
  /** Custom header background color */
  headerBgColor?: string;
}

/**
 * A reusable card component with standardized styling for titles, content, and actions
 */
export function ActionCard({
  title,
  description,
  children,
  actions,
  icon,
  isLoading = false,
  hasError = false,
  className = '',
  headerActions,
  fullHeight = false,
  width = 'auto',
  headerBgColor = 'bg-gray-100 dark:bg-zinc-800'
}: ActionCardProps) {
  return (
    <div 
      className={`border rounded-md overflow-hidden bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200 ${fullHeight ? 'h-full flex flex-col' : ''} ${hasError ? 'border-red-300' : 'border-gray-200'} ${className}`}
      style={{ width }}
    >
      {/* Card Header */}
      <div className={`${headerBgColor} px-4 py-2 border-b flex justify-between items-center`}>
        <div className="flex items-center">
          {icon && <div className="mr-2">{icon}</div>}
          <div>
            <h3 className="font-medium text-gray-800 dark:text-gray-200">{title}</h3>
            {description && <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>}
          </div>
        </div>
        
        {headerActions && (
          <div className="flex items-center">
            {headerActions}
          </div>
        )}
      </div>
      
      {/* Card Content */}
      <div className={`p-4 ${fullHeight ? 'flex-1 overflow-auto' : ''} ${isLoading ? 'opacity-50' : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          children
        )}
      </div>
      
      {/* Card Footer with Actions */}
      {actions && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-900 border-t flex justify-end items-center space-x-2">
          {actions}
        </div>
      )}
    </div>
  );
} 