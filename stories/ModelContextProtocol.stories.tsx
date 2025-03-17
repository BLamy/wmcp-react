import React, { useEffect, useState, useRef } from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { 
  useMCPServer, 
  ServerConfig,
  MCPServerStatus,
  ReadResourceResponse
} from '../src/wmcp';
import { Form } from '../src/Form';
import { TextField } from '../src/TextField';
import { NumberField } from '../src/NumberField';
import { DateField } from '../src/DateField';
import { Checkbox, CheckboxGroup } from '../src/Checkbox';
import { Button } from '../src/Button';
import { ActionCard, ErrorDisplay, LoadingIndicator } from '../src/wmcp/components';
import { Tool, Resource } from '@modelcontextprotocol/sdk/types';

const meta: Meta = {
  title: 'MCP/Examples',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

/**
 * A simple status component that displays the MCP server status
 */
const StatusIndicator = ({ status }: { status: MCPServerStatus }) => {
  const statusColors: Record<MCPServerStatus, string> = {
    'NO_WEBCONTAINER_CONTEXT': 'bg-gray-300',
    'INSTALLING_NODE_MODULES': 'bg-yellow-500 animate-pulse',
    'STARTING': 'bg-yellow-500 animate-pulse',
    'READY': 'bg-green-500',
    'RESTARTING': 'bg-orange-500 animate-pulse',
    'ERROR': 'bg-red-500'
  };

  const statusLabels: Record<MCPServerStatus, string> = {
    'NO_WEBCONTAINER_CONTEXT': 'No WebContainer',
    'INSTALLING_NODE_MODULES': 'Installing Modules',
    'STARTING': 'Starting',
    'READY': 'Ready',
    'RESTARTING': 'Restarting',
    'ERROR': 'Error'
  };

  return (
    <div className="flex items-center">
      <div className={`w-3 h-3 rounded-full mr-2 ${statusColors[status]}`}></div>
      <span className="text-sm font-medium">{statusLabels[status]}</span>
    </div>
  );
};

// Wrapper component for all MCP demo stories
const MCPDemo = ({ 
  children,
  title,
  description,
  serverConfigs = {
    'server-everything': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
      env: {}
    }
  }
}: { 
  children: React.ReactNode,
  title: string,
  description: string,
  serverConfigs?: Record<string, ServerConfig>
}) => {
  // Pass the serverConfigs to the children as a render prop
  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="mb-4 text-gray-600">{description}</p>
      
      {React.Children.map(children, child => 
        React.isValidElement(child) 
          ? React.cloneElement(child as React.ReactElement<any>, { serverConfigs })
          : child
      )}
    </div>
  );
};

// Basic example showing server status and initialization
export const BasicSetup: Story = {
  render: () => (
    <MCPDemo 
      title="Basic MCP Setup" 
      description="This example demonstrates the basic setup of an MCP server and displays its status."
    >
      <BasicSetupContent />
    </MCPDemo>
  )
};

function BasicSetupContent({ serverConfigs = {
  'server-everything': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    env: {}
  }
}}) {
  // Use the hook directly with the server configs
  const { status, error } = useMCPServer({ mcpServers: serverConfigs });
  
  return (
    <div className="p-4 border rounded-md">
      <h2 className="text-lg font-semibold mb-4">MCP Server Status</h2>
      <div className="mb-4">
        <StatusIndicator status={status} />
      </div>
      
      {error && (
        <div className="p-3 bg-red-100 border border-red-200 rounded-md mt-4">
          <p className="text-red-700 font-medium">Error:</p>
          <p className="text-red-600">{error.message}</p>
        </div>
      )}
      
      {status === 'READY' && (
        <div className="p-3 bg-green-100 border border-green-200 rounded-md mt-4">
          <p className="text-green-700">MCP Server is ready to use!</p>
        </div>
      )}
    </div>
  );
}

// New component for dynamic form generation based on tool schema
function ToolExecutionForm({ 
  tool, 
  onExecute, 
  isExecuting 
}: { 
  tool: Tool, 
  onExecute: (args: any) => Promise<void>, 
  isExecuting: boolean 
}) {
  const [formState, setFormState] = React.useState<Record<string, any>>({});
  const [selectedSchemaVariant, setSelectedSchemaVariant] = React.useState<number>(0);
  
  // Reset form state when tool changes
  React.useEffect(() => {
    setFormState({});
    setSelectedSchemaVariant(0);
  }, [tool]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExecute(formState);
  };

  // Helper to determine field type from schema
  const getFieldType = (schema: any, propertyName: string) => {
    if (!schema || !schema.properties || !schema.properties[propertyName]) {
      return 'string';
    }

    const property = schema.properties[propertyName];
    const type = property.type;

    if (property.enum) {
      return 'enum';
    } else if (property.oneOf || property.anyOf) {
      return 'variant';
    } else if (type === 'number' || type === 'integer') {
      return 'number';
    } else if (type === 'boolean') {
      return 'boolean';
    } else if (type === 'string') {
      if (property.format === 'date' || property.format === 'date-time') {
        return 'date';
      }
      return 'string';
    } else if (type === 'array') {
      return 'array';
    } else if (type === 'object') {
      return 'object';
    }
    
    return 'string';
  };

  // Update form state for a specific field
  const updateField = (name: string, value: any) => {
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Render variant selection for oneOf/anyOf
  const renderVariantField = (name: string, property: any) => {
    const variants = property.oneOf || property.anyOf || [];
    const isOneOf = !!property.oneOf;
    
    // No need for variant selection if only one option
    if (variants.length <= 1) {
      return renderSimpleField(name, variants[0] || {}, true);
    }

    return (
      <div key={name} className="border rounded-md p-3 mb-3">
        <div className="font-medium mb-2">{name}</div>
        <div className="mb-3">
          <label className="text-sm font-medium">
            Select {isOneOf ? 'one of' : 'any of'} these variants:
          </label>
          <select
            value={selectedSchemaVariant}
            onChange={(e) => setSelectedSchemaVariant(Number(e.target.value))}
            className="w-full px-3 py-2 mt-1 border-2 rounded-md focus:border-blue-600 focus:outline-none"
          >
            {variants.map((variant: any, index: number) => (
              <option key={index} value={index}>
                {variant.title || `Variant ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
        {renderSimpleField(`${name}Value`, variants[selectedSchemaVariant] || {}, true)}
      </div>
    );
  };

  // Render a simple field based on its type
  const renderSimpleField = (name: string, property: any, isNested: boolean = false) => {
    const type = property.type || 'string';
    const description = property.description || '';
    
    if (property.enum) {
      return (
        <div key={name} className="flex flex-col gap-1">
          {!isNested && (
            <label className="text-sm font-medium">
              {name}
            </label>
          )}
          {description && (
            <div className="text-sm text-gray-600">{description}</div>
          )}
          <select 
            value={formState[name] || ''}
            onChange={(e) => updateField(name, e.target.value)}
            className="px-3 py-2 border-2 rounded-md focus:border-blue-600 focus:outline-none"
          >
            <option value="" disabled>Select an option</option>
            {property.enum?.map((value: any) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      );
    }
    
    switch (type) {
      case 'number':
      case 'integer':
        return (
          <NumberField
            key={name}
            label={!isNested ? name : undefined}
            description={description}
            value={formState[name] || ''}
            onChange={(value) => updateField(name, value)}
          />
        );
      case 'boolean':
        return (
          <Checkbox
            key={name}
            isSelected={formState[name] || false}
            onChange={(value) => updateField(name, value)}
          >
            {!isNested ? name : property.title || 'Value'}
          </Checkbox>
        );
      case 'object':
        return (
          <div key={name} className="border rounded-md p-3 mb-2">
            {!isNested && <div className="font-medium mb-2">{name}</div>}
            <TextField
              label={property.title || 'JSON Object'}
              description={description}
              value={typeof formState[name] === 'object' ? JSON.stringify(formState[name]) : formState[name] || ''}
              onChange={(value) => {
                try {
                  const parsed = JSON.parse(value);
                  updateField(name, parsed);
                } catch (e) {
                  // If not valid JSON, store as string
                  updateField(name, value);
                }
              }}
            />
          </div>
        );
      case 'array':
        return (
          <div key={name} className="border rounded-md p-3 mb-2">
            {!isNested && <div className="font-medium mb-2">{name}</div>}
            <TextField
              label={property.title || 'JSON Array'}
              description={description}
              value={Array.isArray(formState[name]) ? JSON.stringify(formState[name]) : formState[name] || '[]'}
              onChange={(value) => {
                try {
                  const parsed = JSON.parse(value);
                  updateField(name, parsed);
                } catch (e) {
                  // If not valid JSON, store as string
                  updateField(name, value);
                }
              }}
            />
          </div>
        );
      case 'string':
      default:
        return (
          <TextField
            key={name}
            label={!isNested ? name : property.title || 'Value'}
            description={description}
            value={formState[name] || ''}
            onChange={(value) => updateField(name, value)}
          />
        );
    }
  };

  // Render appropriate field based on schema
  const renderField = (name: string, schema: any) => {
    const property = schema?.properties?.[name] || {};
    const isRequired = schema?.required?.includes(name) || false;
    
    if (property.oneOf || property.anyOf) {
      return renderVariantField(name, property);
    }
    
    const fieldType = getFieldType(schema, name);
    const description = property.description || '';
    
    switch (fieldType) {
      case 'enum':
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              {name}{isRequired ? ' *' : ''}
            </label>
            {description && (
              <div className="text-sm text-gray-600">{description}</div>
            )}
            <select 
              value={formState[name] || ''}
              onChange={(e) => updateField(name, e.target.value)}
              className="px-3 py-2 border-2 rounded-md focus:border-blue-600 focus:outline-none"
              required={isRequired}
            >
              <option value="" disabled>Select an option</option>
              {property.enum?.map((value: any) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        );
      case 'number':
        return (
          <NumberField
            key={name}
            label={`${name}${isRequired ? ' *' : ''}`}
            description={description}
            value={formState[name] || ''}
            onChange={(value) => updateField(name, value)}
            isRequired={isRequired}
          />
        );
      case 'boolean':
        return (
          <Checkbox
            key={name}
            isSelected={formState[name] || false}
            onChange={(value) => updateField(name, value)}
          >
            {name}{isRequired ? ' *' : ''}
          </Checkbox>
        );
      case 'date':
        return (
          <DateField
            key={name}
            label={`${name}${isRequired ? ' *' : ''}`}
            description={description}
            value={formState[name] || undefined}
            onChange={(value) => updateField(name, value)}
            isRequired={isRequired}
          />
        );
      case 'object':
        return (
          <div key={name} className="border rounded-md p-3 mb-2">
            <div className="font-medium mb-2">{name}{isRequired ? ' *' : ''}</div>
            <TextField
              label={`${name} (JSON)`}
              description={description}
              value={typeof formState[name] === 'object' ? JSON.stringify(formState[name]) : formState[name] || ''}
              onChange={(value) => {
                try {
                  const parsed = JSON.parse(value);
                  updateField(name, parsed);
                } catch (e) {
                  // If not valid JSON, store as string
                  updateField(name, value);
                }
              }}
              isRequired={isRequired}
            />
          </div>
        );
      case 'array':
        return (
          <div key={name} className="border rounded-md p-3 mb-2">
            <div className="font-medium mb-2">{name}{isRequired ? ' *' : ''}</div>
            <TextField
              label={`${name} (JSON array)`}
              description={description}
              value={Array.isArray(formState[name]) ? JSON.stringify(formState[name]) : formState[name] || '[]'}
              onChange={(value) => {
                try {
                  const parsed = JSON.parse(value);
                  updateField(name, parsed);
                } catch (e) {
                  // If not valid JSON, store as string
                  updateField(name, value);
                }
              }}
              isRequired={isRequired}
            />
          </div>
        );
      case 'string':
      default:
        return (
          <TextField
            key={name}
            label={`${name}${isRequired ? ' *' : ''}`}
            description={description}
            value={formState[name] || ''}
            onChange={(value) => updateField(name, value)}
            isRequired={isRequired}
          />
        );
    }
  };

  if (!tool) {
    return null;
  }

  const schema = tool.inputSchema || { properties: {}, required: [] };
  const properties = schema.properties || {};
  const propertyNames = Object.keys(properties);

  return (
    <Form onSubmit={handleSubmit}>
      <div className="text-sm text-gray-600 mb-4">
        Fill in the parameters for the "{tool.name}" tool:
      </div>
      
      {propertyNames.length === 0 ? (
        <div className="text-gray-500 italic mb-4">This tool doesn't require any parameters</div>
      ) : (
        propertyNames.map(name => renderField(name, schema))
      )}
      
      <Button type="submit" isDisabled={isExecuting}>
        {isExecuting ? 'Executing...' : 'Execute Tool'}
      </Button>
    </Form>
  );
}

// Tools listing and execution example
export const ToolsExample: Story = {
  render: () => (
    <MCPDemo 
      title="MCP Tools Example" 
      description="This example demonstrates how to list and execute tools from an MCP server."
    >
      <ToolsExampleContent />
    </MCPDemo>
  )
};

function ToolsExampleContent({ serverConfigs = {
  'server-everything': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    env: {}
  }
}}) {
  // Use the hook directly with the server configs
  const mcpServer = useMCPServer({ mcpServers: serverConfigs });
  const { status, tools, executeTool, refreshTools, error } = mcpServer;
  
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolResult, setToolResult] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionSuccess, setExecutionSuccess] = useState<boolean | null>(null);
  
  const handleExecuteTool = async (args: any) => {
    if (!selectedTool) return;
    
    setIsExecuting(true);
    setToolResult('');
    setExecutionSuccess(null);
    
    try {
      const result = await executeTool(selectedTool.name, args);
      setToolResult(JSON.stringify(result, null, 2));
      setExecutionSuccess(true);
    } catch (err) {
      setToolResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setExecutionSuccess(false);
    } finally {
      setIsExecuting(false);
    }
  };

  // Format JSON with syntax highlighting
  const formatResult = (result: string) => {
    if (!result) return null;
    
    try {
      // If it's a valid JSON string, try to parse and re-stringify it with formatting
      const isJson = result.startsWith('{') || result.startsWith('[');
      if (isJson) {
        try {
          const parsed = JSON.parse(result);
          return JSON.stringify(parsed, null, 2);
        } catch (e) {
          // If it fails to parse, just return the original string
          return result;
        }
      }
      return result;
    } catch (e) {
      return result;
    }
  };
  
  return (
    <div className="p-4 border rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">MCP Tools</h2>
        <div className="flex items-center space-x-2">
          <StatusIndicator status={status} />
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => refreshTools()}
            disabled={status !== 'READY'}
          >
            Refresh
          </button>
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-100 border border-red-200 rounded-md mb-4">
          <p className="text-red-700 font-medium">Error:</p>
          <p className="text-red-600">{error.message}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Left Column - Tools List */}
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 font-medium border-b">
            Available Tools
          </div>
          <div className="p-2 max-h-60 overflow-y-auto">
            {status !== 'READY' ? (
              <div className="p-3 text-gray-500">Loading tools...</div>
            ) : tools.length === 0 ? (
              <div className="p-3 text-gray-500">No tools available</div>
            ) : (
              <ul className="divide-y">
                {tools.map((tool: Tool) => (
                  <li 
                    key={tool.name}
                    className={`p-2 cursor-pointer hover:bg-gray-100 ${selectedTool?.name === tool.name ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedTool(tool)}
                  >
                    <div className="font-medium">{tool.name}</div>
                    <div className="text-sm text-gray-600">{tool.description}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        {/* Right Column - Tool Execution */}
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 font-medium border-b">
            Tool Execution
          </div>
          <div className="p-4">
            {selectedTool ? (
              <>
                <h3 className="font-medium mb-2">{selectedTool.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{selectedTool.description}</p>
                
                <ToolExecutionForm 
                  tool={selectedTool} 
                  onExecute={handleExecuteTool} 
                  isExecuting={isExecuting} 
                />
                
                {executionSuccess !== null && (
                  <div className={`mt-4 p-3 rounded-md border ${executionSuccess ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className={`font-medium ${executionSuccess ? 'text-green-700' : 'text-red-700'}`}>
                      {executionSuccess ? 'Tool executed successfully!' : 'Tool execution failed!'}
                    </p>
                  </div>
                )}
                
                {toolResult && (
                  <div className="mt-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium">Result:</label>
                    </div>
                    <pre className="p-2 bg-gray-100 border rounded-md text-sm overflow-auto max-h-60 font-mono">
                      {formatResult(toolResult)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-500 text-center p-4">
                Select a tool from the list to execute
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Resources example
export const ResourcesExample: Story = {
  render: () => (
    <MCPDemo 
      title="MCP Resources Example" 
      description="This example demonstrates how to list and fetch resources from an MCP server."
    >
      <ResourcesExampleContent />
    </MCPDemo>
  )
};

function ResourcesExampleContent({ serverConfigs = {
  'server-everything': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    env: {}
  }
}}) {
  // Use the hook directly with the server configs
  const mcpServer = useMCPServer({ mcpServers: serverConfigs });
  const { status, resources, fetchResource, refreshResources, error } = mcpServer;
  
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [resourceContent, setResourceContent] = useState<ReadResourceResponse | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  
  const handleFetchResource = async () => {
    if (!selectedResource) return;
    
    setIsFetching(true);
    setResourceContent(null);
    
    try {
      const result = await fetchResource(selectedResource.uri);
      setResourceContent(result);
    } catch (err) {
      console.error('Error fetching resource:', err);
    } finally {
      setIsFetching(false);
    }
  };
  
  return (
    <div className="p-4 border rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">MCP Resources</h2>
        <div className="flex items-center space-x-2">
          <StatusIndicator status={status} />
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => refreshResources()}
            disabled={status !== 'READY'}
          >
            Refresh
          </button>
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-100 border border-red-200 rounded-md mb-4">
          <p className="text-red-700 font-medium">Error:</p>
          <p className="text-red-600">{error.message}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Left Column - Resources List */}
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 font-medium border-b">
            Available Resources
          </div>
          <div className="p-2 max-h-60 overflow-y-auto">
            {status !== 'READY' ? (
              <div className="p-3 text-gray-500">Loading resources...</div>
            ) : resources.length === 0 ? (
              <div className="p-3 text-gray-500">No resources available</div>
            ) : (
              <ul className="divide-y">
                {resources.map((resource: Resource) => (
                  <li 
                    key={resource.uri}
                    className={`p-2 cursor-pointer hover:bg-gray-100 ${selectedResource?.uri === resource.uri ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedResource(resource)}
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
        
        {/* Right Column - Resource Content */}
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 font-medium border-b">
            Resource Content
          </div>
          <div className="p-4">
            {selectedResource ? (
              <>
                <h3 className="font-medium mb-2">{selectedResource.name}</h3>
                <p className="text-sm text-gray-600 mb-1">URI: {selectedResource.uri}</p>
                
                <div className="flex justify-end mb-3">
                  <button
                    onClick={handleFetchResource}
                    disabled={isFetching || status !== 'READY'}
                    className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetching ? 'Fetching...' : 'Fetch Content'}
                  </button>
                </div>
                
                {resourceContent ? (
                  <div>
                    {resourceContent.contents.map((content, index) => (
                      <div key={index} className="mb-3">
                        <pre className="p-2 bg-gray-100 border rounded-md text-sm overflow-auto max-h-60">
                          {content.text}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border rounded-md p-3 text-center text-gray-500">
                    {isFetching ? 'Loading resource content...' : 'Click "Fetch Content" to view the resource'}
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-500 text-center p-4">
                Select a resource from the list to view its content
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Advanced example with multiple servers and error handling
export const MultiServerExample: Story = {
  render: () => (
    <MCPDemo 
      title="Multiple MCP Servers Example" 
      description="This example demonstrates how to work with multiple MCP servers simultaneously."
      serverConfigs={{
        'server-memory': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory@latest', '--init', '--debug'],
          env: {}
        },
        'server-filesystem': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem@latest', '/'],
          env: {}
        }
      }}
    >
      <MultiServerExampleContent />
    </MCPDemo>
  )
};

function MultiServerExampleContent({ serverConfigs = {
  'server-memory': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory@latest', '--init', '--debug'],
    env: {}
  },
  'server-filesystem': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem@latest', '/'],
    env: {}
  }
}}) {
  // Use the hook directly with the server configs
  const mcpServer = useMCPServer({ mcpServers: serverConfigs });
  const { status, tools, resources, error } = mcpServer;
  
  return (
    <div className="p-4 border rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Multiple MCP Servers</h2>
        <StatusIndicator status={status} />
      </div>
      
      {error && (
        <div className="p-3 bg-red-100 border border-red-200 rounded-md mb-4">
          <p className="text-red-700 font-medium">Error:</p>
          <p className="text-red-600">{error.message}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tools from both servers */}
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 font-medium border-b">
            Tools from All Servers
          </div>
          <div className="p-2 max-h-60 overflow-y-auto">
            {status !== 'READY' ? (
              <div className="p-3 text-gray-500">Loading tools...</div>
            ) : tools.length === 0 ? (
              <div className="p-3 text-gray-500">No tools available</div>
            ) : (
              <ul className="divide-y">
                {tools.map((tool: Tool) => (
                  <li key={tool.name} className="p-2">
                    <div className="font-medium">{tool.name}</div>
                    <div className="text-sm text-gray-600">{tool.description}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        {/* Resources from both servers */}
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 font-medium border-b">
            Resources from All Servers
          </div>
          <div className="p-2 max-h-60 overflow-y-auto">
            {status !== 'READY' ? (
              <div className="p-3 text-gray-500">Loading resources...</div>
            ) : resources.length === 0 ? (
              <div className="p-3 text-gray-500">No resources available</div>
            ) : (
              <ul className="divide-y">
                {resources.map((resource: Resource) => (
                  <li key={resource.uri} className="p-2">
                    <div className="font-medium">{resource.name}</div>
                    <div className="text-sm text-gray-600 truncate">{resource.uri}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Direct hook usage example (already using the direct approach)
export const DirectHookUsage: Story = {
  render: () => (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Direct MCP Hook Usage</h1>
      <p className="mb-4 text-gray-600">
        This example demonstrates how to use the useMCPServer hook directly.
      </p>
      
      <DirectHookUsageContent />
    </div>
  )
};

function DirectHookUsageContent() {
  const mcpServer = useMCPServer({
    mcpServers: {
      'server-everything': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-everything'],
        env: {}
      }
    }
  });
  
  const { status, tools, error } = mcpServer;
  
  return (
    <div className="p-4 border rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Direct Hook Usage</h2>
        <StatusIndicator status={status} />
      </div>
      
      {error && (
        <div className="p-3 bg-red-100 border border-red-200 rounded-md mb-4">
          <p className="text-red-700 font-medium">Error:</p>
          <p className="text-red-600">{error.message}</p>
        </div>
      )}
      
      <div className="bg-gray-100 p-3 rounded-md mb-4">
        <p className="text-sm text-gray-700">
          This example shows that you can use the <code className="bg-gray-200 px-1 rounded">useMCPServer</code> hook 
          directly in your components. This is useful when you want different parts of 
          your app to connect to different MCP servers.
        </p>
      </div>
      
      <div className="border rounded-md overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 font-medium border-b">
          Tools from Direct Hook
        </div>
        <div className="p-2 max-h-60 overflow-y-auto">
          {status !== 'READY' ? (
            <div className="p-3 text-gray-500">Loading tools...</div>
          ) : tools.length === 0 ? (
            <div className="p-3 text-gray-500">No tools available</div>
          ) : (
            <ul className="divide-y">
              {tools.map((tool: Tool) => (
                <li key={tool.name} className="p-2">
                  <div className="font-medium">{tool.name}</div>
                  <div className="text-sm text-gray-600">{tool.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Complete demo with all features
export const ComprehensiveExample: Story = {
  render: () => (
    <MCPDemo 
      title="Comprehensive MCP Example" 
      description="A complete example demonstrating all main features of the MCP library."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BasicSetupContent />
        <ToolsExampleContent />
        <ResourcesExampleContent />
      </div>
    </MCPDemo>
  )
};

/**
 * A component to browse and view available resources
 */
function ResourceViewer() {
  // Use the hook directly
  const mcpServer = useMCPServer({
    mcpServers: {
      'server-everything': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-everything'],
        env: {}
      }
    }
  });
  
  const { resources, status, error } = mcpServer;
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [resourceContent, setResourceContent] = useState<ReadResourceResponse | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const fetchResource = async () => {
    if (!selectedResource) return;
    
    setIsFetching(true);
    try {
      // Use execute method from mcpServer instead
      const result = await mcpServer.executeTool('readResource', { resourceName: selectedResource });
      setResourceContent(result as ReadResourceResponse);
    } catch (error) {
      console.error("Error fetching resource:", error);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Resource Viewer</h2>
      <StatusIndicator status={status} />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="border rounded-md bg-white p-4 shadow-sm">
          <h3 className="font-medium mb-3">Available Resources</h3>
          
          {resources.length === 0 ? (
            <div className="text-gray-500 text-center p-4">
              {status === 'READY' ? 'No resources available' : 'Waiting for server...'}
            </div>
          ) : (
            <ul className="space-y-2">
              {resources.map((resource: Resource) => (
                <li 
                  key={resource.name}
                  className={`p-2 rounded-md cursor-pointer hover:bg-gray-100 ${
                    selectedResource === resource.name ? 'bg-blue-100 hover:bg-blue-100' : ''
                  }`}
                  onClick={() => {
                    setSelectedResource(resource.name);
                    setResourceContent(null);
                  }}
                >
                  <div className="font-medium">{resource.name}</div>
                  <div className="text-xs text-gray-600">{resource.description || 'No description'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <ActionCard
          title={selectedResource || "Resource Content"}
          description={selectedResource ? "View the resource content" : "Select a resource to view"}
          className="col-span-1 md:col-span-2"
          actions={
            selectedResource && (
              <button 
                onClick={fetchResource}
                disabled={isFetching || status !== 'READY'}
                className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFetching ? 'Fetching...' : 'Fetch Content'}
              </button>
            )
          }
        >
          {selectedResource ? (
            isFetching ? (
              <LoadingIndicator message="Loading resource content..." variant="spinner" className="m-4" />
            ) : (
              resourceContent ? (
                <div>
                  {resourceContent.contents.map((content, index) => (
                    <div key={index} className="mb-3">
                      <pre className="p-2 bg-gray-100 border rounded-md text-sm overflow-auto max-h-60">
                        {content.text}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 border rounded-md p-3 text-center text-gray-500">
                  Click "Fetch Content" to view the resource
                </div>
              )
            )
          ) : (
            <div className="text-gray-500 text-center p-4">
              Select a resource from the list to view its content
            </div>
          )}
        </ActionCard>
      </div>
    </div>
  );
}

export const ResourceBrowser: Story = {
  name: 'Resource Browser',
  render: () => <ResourceViewer />
};