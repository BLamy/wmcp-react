import React from 'react';

export interface Resource {
  name: string;
  uri: string;
  description?: string;
  [key: string]: any;
}

export interface ResourcesListProps {
  /** Array of resources to display */
  resources: Resource[];
  /** Handler for resource selection */
  onSelectResource?: (resource: Resource) => void;
  /** Currently selected resource */
  selectedResource?: Resource | null;
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Optional loading message */
  loadingMessage?: string;
  /** Optional empty message */
  emptyMessage?: string;
  /** Optional additional CSS class names */
  className?: string;
  /** Max height for the list container */
  maxHeight?: string;
}

/**
 * A reusable component for displaying MCP resources
 */
export function ResourcesList({
  resources,
  onSelectResource,
  selectedResource,
  isLoading = false,
  loadingMessage = 'Loading resources...',
  emptyMessage = 'No resources available',
  className = '',
  maxHeight = '60vh'
}: ResourcesListProps) {
  return (
    <div className={`border rounded-md overflow-hidden ${className}`}>
      <div className="bg-gray-100 px-4 py-2 font-medium border-b">
        Available Resources
      </div>
      <div className={`p-2 overflow-y-auto`} style={{ maxHeight }}>
        {isLoading ? (
          <div className="p-3 text-gray-500">{loadingMessage}</div>
        ) : resources.length === 0 ? (
          <div className="p-3 text-gray-500">{emptyMessage}</div>
        ) : (
          <ul className="divide-y">
            {resources.map(resource => (
              <li 
                key={resource.uri}
                className={`p-2 ${onSelectResource ? 'cursor-pointer hover:bg-gray-100' : ''} ${
                  selectedResource?.uri === resource.uri ? 'bg-blue-50' : ''
                }`}
                onClick={() => onSelectResource && onSelectResource(resource)}
              >
                <div className="font-medium">{resource.name}</div>
                <div className="text-sm text-gray-600 truncate">{resource.uri}</div>
                {resource.description && (
                  <div className="text-sm text-gray-500 mt-1">{resource.description}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 