import React from 'react';

export interface ErrorDisplayProps {
  /** The error object or error message string */
  error: Error | string | null | undefined;
  /** Optional title to display above the error message */
  title?: string;
  /** Optional additional CSS class names */
  className?: string;
}

/**
 * A reusable component for displaying error messages consistently
 */
export function ErrorDisplay({ 
  error, 
  title = 'Error', 
  className = '' 
}: ErrorDisplayProps) {
  if (!error) return null;
  
  const errorMessage = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? error.message 
      : 'An unknown error occurred';

  return (
    <div className={`p-3 bg-red-100 border border-red-200 rounded-md ${className}`}>
      <p className="text-red-700 font-medium">{title}:</p>
      <p className="text-red-600">{errorMessage}</p>
    </div>
  );
} 