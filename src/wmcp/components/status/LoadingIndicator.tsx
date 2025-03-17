import React from 'react';

export interface LoadingIndicatorProps {
  /** Message to display while loading */
  message?: string;
  /** The type of loading indicator to show */
  variant?: 'pulse' | 'spinner' | 'dots';
  /** Optional additional CSS class names */
  className?: string;
}

/**
 * A reusable loading indicator component with multiple variants
 */
export function LoadingIndicator({ 
  message = 'Loading...', 
  variant = 'pulse',
  className = '' 
}: LoadingIndicatorProps) {
  
  // Render the appropriate loading variant
  const renderLoadingIndicator = () => {
    switch (variant) {
      case 'spinner':
        return (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
          </div>
        );
      case 'dots':
        return (
          <div className="flex space-x-2 justify-center">
            {[0, 1, 2].map(i => (
              <div 
                key={i} 
                className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" 
                style={{ animationDelay: `${i * 0.15}s` }}
              ></div>
            ))}
          </div>
        );
      case 'pulse':
      default:
        return (
          <div className="animate-pulse bg-blue-100 p-4 rounded-md">
            {message}
          </div>
        );
    }
  };

  return (
    <div className={className}>
      {renderLoadingIndicator()}
    </div>
  );
} 