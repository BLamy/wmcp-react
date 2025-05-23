import React, { useContext, useState } from 'react';
import { WebContainerContext } from '../../providers/Webcontainer';
import { requestRelayManager, generateProxyUrl, isProxyUrl, parseProxyUrl } from '../../lib/RequestRelayUtils';
import { StatusIndicator } from '../status/StatusIndicator';

/**
 * Demo component showing how to use the Request Relay system
 * This demonstrates how to generate proxy URLs and use them instead of direct WebContainer URLs
 */
export function RequestRelayDemo() {
  const { portForwards, status, generateProxyUrl: contextGenerateProxy } = useContext(WebContainerContext);
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [testPath, setTestPath] = useState<string>('/');

  const ports = Object.keys(portForwards).map(Number);
  const hasActivePorts = ports.length > 0;

  const handlePortSelect = (port: number) => {
    setSelectedPort(port);
  };

  const getProxyUrlExample = () => {
    if (!selectedPort) return '';
    return generateProxyUrl(selectedPort, testPath);
  };

  const getDirectUrl = () => {
    if (!selectedPort || !portForwards[selectedPort]) return '';
    return portForwards[selectedPort] + testPath;
  };

  const testUrl = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Request Relay Demo</h2>
        <p className="text-sm text-gray-600">
          This demo shows how the request relay system creates proxy URLs for WebContainer development servers.
        </p>
      </div>

      {/* Status */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">WebContainer Status</h3>
        <StatusIndicator 
          status={status} 
          customLabels={{
            'booting': 'Booting...',
            'installing': 'Installing Dependencies...',
            'mounting': 'Mounting Files...',
            'ready': 'Ready',
            'none': 'Not Started',
            'error': 'Error'
          }}
        />
      </div>

      {/* Port Forwards */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Active Port Forwards ({ports.length})
        </h3>
        
        {!hasActivePorts ? (
          <p className="text-sm text-gray-500 italic">
            No development servers running yet. Start a server in your WebContainer to see port forwards.
          </p>
        ) : (
          <div className="space-y-2">
            {ports.map(port => (
              <div 
                key={port}
                className={`p-3 border rounded cursor-pointer transition-colors ${
                  selectedPort === port 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handlePortSelect(port)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">Port {port}</span>
                    <div className="text-xs text-gray-500 mt-1">
                      Direct URL: {portForwards[port]}
                    </div>
                  </div>
                  <StatusIndicator status="success" size="sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* URL Generation Demo */}
      {selectedPort && (
        <div className="mb-4 p-4 bg-gray-50 rounded">
          <h3 className="text-sm font-medium text-gray-700 mb-3">URL Generation for Port {selectedPort}</h3>
          
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Test Path
            </label>
            <input
              type="text"
              value={testPath}
              onChange={(e) => setTestPath(e.target.value)}
              placeholder="/api/health"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Direct WebContainer URL (CORS Issues)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={getDirectUrl()}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-red-50 border border-red-200 rounded text-red-700"
                />
                <button
                  onClick={() => testUrl(getDirectUrl())}
                  disabled={!getDirectUrl()}
                  className="px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Test (Will Fail)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Proxy URL (Works via Service Worker)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={getProxyUrlExample()}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-green-50 border border-green-200 rounded text-green-700"
                />
                <button
                  onClick={() => testUrl(getProxyUrlExample())}
                  disabled={!getProxyUrlExample()}
                  className="px-3 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Test (Should Work)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URL Parsing Demo */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">URL Utility Functions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-medium">isProxyUrl Examples:</span>
            <div className="mt-1 space-y-1">
              <div>
                <code className="bg-gray-100 px-1 rounded">app-3000.localhost.com</code>
                <span className="ml-2">{isProxyUrl('http://app-3000.localhost.com') ? '✅' : '❌'}</span>
              </div>
              <div>
                <code className="bg-gray-100 px-1 rounded">localhost:3000</code>
                <span className="ml-2">{isProxyUrl('http://localhost:3000') ? '✅' : '❌'}</span>
              </div>
            </div>
          </div>
          <div>
            <span className="font-medium">parseProxyUrl Example:</span>
            <div className="mt-1">
              <code className="bg-gray-100 px-1 rounded text-xs">
                {JSON.stringify(parseProxyUrl('http://app-3000.localhost.com/api/test'))}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded">
        <h4 className="font-medium mb-2">How it works:</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>WebContainer starts development servers on various ports</li>
          <li>The Request Relay system generates proxy URLs like <code>app-3000.domain.com</code></li>
          <li>Service Worker intercepts requests to these proxy URLs</li>
          <li>Requests are forwarded to the actual WebContainer servers with proper CORS headers</li>
          <li>This allows seamless access without CORS issues</li>
        </ol>
      </div>
    </div>
  );
}