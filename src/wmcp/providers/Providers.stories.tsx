import React, { useState } from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { WebContainerContext } from '@/wmcp/providers/Webcontainer';
import { McpProvider, useMcp } from '@/providers/McpProvider';
import { AgentProvider, useAgent } from '@/providers/AgentProvider';
import { Button } from '@/components/aria/Button';
import { TextField } from '@/components/aria/TextField';
import { SecureFormProvider } from '@/components/Auth/SecureFormProvider';
import { ApiKeyForm } from '@/components/Auth/ApiKeyForm';

const meta: Meta = {
  title: 'MCP/MoreExamples',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

// Wrapper component to provide consistent styling
const DemoCard = ({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode;
}) => (
  <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>
    </div>
    <div className="p-4 bg-white dark:bg-gray-900">
      {children}
    </div>
  </div>
);

// Demo components that use our providers
const WebContainerStatus = () => {
  const { webContainer, status } = React.useContext(WebContainerContext);
  
  return (
    <DemoCard title="WebContainer Status">
      <div className="space-y-2">
        <div className="flex items-center">
          <span className="font-medium mr-2">Status:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            status === 'ready' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}>
            {status}
          </span>
        </div>
        <div>
          <span className="font-medium">Available:</span> {webContainer ? 'Yes' : 'No'}
        </div>
      </div>
    </DemoCard>
  );
};

const McpStatus = () => {
  const { 
    status, 
    activeServers, 
    availableServers,
    tools,
    activateServer,
    deactivateServer
  } = useMcp();
  
  return (
    <DemoCard title="MCP Status">
      <div className="space-y-4">
        <div className="flex items-center">
          <span className="font-medium mr-2">Status:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            status === 'READY' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            status === 'ERROR' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
            status === 'STARTING' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
            'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          }`}>
            {status}
          </span>
        </div>
        
        <div>
          <h4 className="font-medium mb-2">Available Servers:</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(availableServers).map(([name, config]) => {
              const isActive = !!activeServers[name];
              return (
                <div key={name} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm truncate mr-2">{name}</span>
                  <Button
                    onPress={() => isActive ? deactivateServer(name) : activateServer(name)}
                    variant={isActive ? "destructive" : "primary"}
                  >
                    {isActive ? 'Stop' : 'Start'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
        
        {tools.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Available Tools ({tools.length}):</h4>
            <div className="max-h-48 overflow-y-auto border rounded p-2">
              <ul className="space-y-1">
                {tools.map((tool, i) => (
                  <li key={i} className="text-sm">• {tool.name}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </DemoCard>
  );
};

const AgentChat = () => {
  const { 
    messages, 
    sendMessage, 
    clearMessages,
    isLoading,
    currentError,
  } = useAgent();
  
  const [input, setInput] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const message = input;
    setInput('');
    await sendMessage(message);
  };
  
  return (
    <DemoCard title="Agent Chat">
      <div className="flex flex-col h-[400px]">
        <div className="flex-1 overflow-y-auto mb-4 p-3 border rounded-md bg-gray-50 dark:bg-gray-800">
          {messages.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-4">No messages yet</div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                if (msg.type === 'user_message' || msg.type === 'assistant_message') {
                  return (
                    <div 
                      key={msg.id} 
                      className={`p-3 rounded-lg max-w-[80%] ${
                        msg.type === 'user_message' 
                          ? 'ml-auto bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {typeof msg.content === 'string' 
                        ? msg.content 
                        : msg.content.map((block, i) => 
                            block.type === 'text' ? <p key={i}>{block.text}</p> : null
                          )}
                    </div>
                  );
                } else if (msg.type === 'tool_call') {
                  return (
                    <div 
                      key={msg.id}
                      className="p-2 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20"
                    >
                      <div className="text-xs text-yellow-700 dark:text-yellow-500 font-medium">
                        Tool: {msg.toolCall.name}
                      </div>
                    </div>
                  );
                } else if (msg.type === 'tool_result') {
                  return (
                    <div 
                      key={msg.id}
                      className={`p-2 rounded-lg border ${
                        msg.result.status === 'success'
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' 
                          : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                      }`}
                    >
                      <div className={`text-xs font-medium ${
                        msg.result.status === 'success'
                          ? 'text-green-700 dark:text-green-500'
                          : 'text-red-700 dark:text-red-500'
                      }`}>
                        Result: {msg.result.status}
                      </div>
                      {msg.result.message && <div className="text-sm mt-1">{msg.result.message}</div>}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <TextField
            className="flex-1"
            value={input}
            onChange={(v) => setInput(v)}
            aria-label="Message input"
            isDisabled={isLoading}
          />
          <Button type="submit" isDisabled={isLoading || !input.trim()}>
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
          <Button variant="secondary" onPress={clearMessages}>
            Clear
          </Button>
        </form>
        
        {currentError && (
          <div className="mt-2 p-2 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20 rounded">
            Error: {currentError}
          </div>
        )}
      </div>
    </DemoCard>
  );
};

// Demo story showing all providers (expects apiKey already provided by SecureFormProvider)
const ProvidersDemo = () => {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">Provider Architecture</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        This demo showcases the provider hierarchy and interactions: WebContainer → MCP → Agent
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <WebContainerStatus />
          <McpStatus />
        </div>
        <div>
          <AgentChat />
        </div>
      </div>
    </div>
  );
};

// Story to show all providers working together
export const AllProviders: Story = {
  render: () => (
      <McpProvider>
        <SecureFormProvider<{ apiKey: string }>
          storageKey="anthropic_api"
          fallback={(props) => <ApiKeyForm {...props} />}
        >
          {({ values, login }) => (
            <AgentProvider apiKey={values?.apiKey} onRequestApiKey={login}>
              <ProvidersDemo />
            </AgentProvider>
          )}
        </SecureFormProvider>
      </McpProvider>
  )
};

// Individual provider stories
export const WebContainerOnly: Story = {
  render: () => (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">WebContainer Provider</h1>
        <WebContainerStatus />
      </div>
  )
};

export const McpProviderDemo: Story = {
  render: () => (
      <McpProvider>
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">MCP Provider</h1>
          <div className="grid gap-6 md:grid-cols-2">
            <WebContainerStatus />
            <McpStatus />
          </div>
        </div>
      </McpProvider>
  )
}; 