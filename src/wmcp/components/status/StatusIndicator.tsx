import React from 'react';

/**
 * Generic status types that can be used across the application
 */
export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'inactive';

/**
 * Props for the StatusIndicator component
 */
export interface StatusIndicatorProps {
  /** The status to display */
  status: StatusType | string;
  /** Optional custom colors map for status types */
  customColors?: Record<string, string>;
  /** Optional custom labels map for status types */
  customLabels?: Record<string, string>;
  /** Size of the indicator */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * A reusable status indicator component that shows a colored dot with a label
 * Can be used to represent states of various services or processes
 */
export function StatusIndicator({
  status,
  customColors,
  customLabels,
  size = 'md'
}: StatusIndicatorProps) {
  // Default styling
  const defaultColors: Record<StatusType, string> = {
    'success': 'bg-green-500',
    'error': 'bg-red-500',
    'warning': 'bg-yellow-500',
    'info': 'bg-blue-500',
    'loading': 'bg-yellow-500 animate-pulse',
    'inactive': 'bg-gray-300'
  };

  const defaultLabels: Record<StatusType, string> = {
    'success': 'Ready',
    'error': 'Error',
    'warning': 'Warning',
    'info': 'Info',
    'loading': 'Loading',
    'inactive': 'Inactive'
  };

  // Merge defaults with custom values
  const colors = { ...defaultColors, ...customColors };
  const labels = { ...defaultLabels, ...customLabels };

  // Determine size classes
  const sizeClasses = {
    'sm': 'w-2 h-2',
    'md': 'w-3 h-3',
    'lg': 'w-4 h-4'
  };

  const colorClass = colors[status as StatusType] || colors.inactive;
  const label = labels[status as StatusType] || status;

  return (
    <div className="flex items-center">
      <div className={`${sizeClasses[size]} rounded-full mr-2 ${colorClass}`}></div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
} 