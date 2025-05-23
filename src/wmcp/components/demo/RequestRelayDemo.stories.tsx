import type { Meta, StoryObj } from '@storybook/react';
import { RequestRelayDemo } from './RequestRelayDemo';
import WebContainerProvider from '../../providers/Webcontainer';

const meta: Meta<typeof RequestRelayDemo> = {
  title: 'WMCP/Demo/RequestRelayDemo',
  component: RequestRelayDemo,
  decorators: [
    (Story) => (
      <WebContainerProvider>
        <Story />
      </WebContainerProvider>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The RequestRelayDemo component demonstrates the request relay system that allows seamless proxying 
of WebContainer development servers through custom URLs, solving CORS issues for local development.

## Features

- **Port Mapping**: Shows active WebContainer development servers
- **URL Generation**: Demonstrates proxy URL generation for each port
- **CORS Solution**: Shows how proxy URLs avoid CORS issues
- **Real-time Updates**: Updates automatically when new servers start
- **Testing Interface**: Allows testing both direct and proxy URLs

## How It Works

1. **Service Worker Interception**: A service worker intercepts requests to proxy URLs
2. **URL Pattern Matching**: Proxy URLs follow the pattern \`app-{port}.{domain}.{tld}\`
3. **Request Forwarding**: Requests are forwarded to actual WebContainer servers
4. **CORS Headers**: Proper CORS headers are added to responses
5. **Transparent Operation**: The browser sees normal HTTP requests

## Usage

The request relay system is automatically enabled when you use the WebContainerProvider. 
You can generate proxy URLs using the provided utilities:

\`\`\`typescript
import { generateProxyUrl, isProxyUrl, parseProxyUrl } from '@/wmcp';

// Generate a proxy URL for port 3000
const proxyUrl = generateProxyUrl(3000, '/api/data');
// Returns: http://app-3000.yourdomain.com/api/data

// Check if a URL is a proxy URL
const isProxy = isProxyUrl('http://app-3000.localhost.com');
// Returns: true

// Parse a proxy URL to extract port and path
const parsed = parseProxyUrl('http://app-3000.localhost.com/api/test');
// Returns: { port: 3000, path: '/api/test' }
\`\`\`

## Integration Points

- **WebContainer Provider**: Automatically configures port mappings
- **Service Worker**: Enhanced \`coi-serviceworker.js\` handles request interception
- **Request Relay Manager**: Manages communication between main thread and service worker
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: `
Default view of the RequestRelayDemo showing the interface for managing and testing proxy URLs.

When WebContainer servers are running, this demo will show:
- Active port forwards with their direct URLs
- Generated proxy URLs for each port
- Side-by-side comparison of direct vs proxy URLs
- Testing buttons to verify functionality
        `,
      },
    },
  },
};

export const WithMockData: Story = {
  args: {},
  decorators: [
    (Story) => {
      // Mock some port forwards for demo purposes
      const MockedWebContainerProvider = ({ children }: { children: React.ReactNode }) => {
        const mockContextValue = {
          webContainer: null,
          registerFilesystem: () => {},
          unregisterFilesystem: () => {},
          filesystemIds: [],
          status: 'ready' as const,
          portForwards: {
            3000: 'http://localhost:3000',
            5173: 'http://localhost:5173',
            8080: 'http://localhost:8080',
          },
          generateProxyUrl: (port: number, path?: string) => 
            `http://app-${port}.localhost.com${path || ''}`,
        };

        return (
          <div>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <strong>Demo Mode:</strong> This story shows the component with mock data to demonstrate 
              the interface with active port forwards.
            </div>
            <Story />
          </div>
        );
      };

      return (
        <MockedWebContainerProvider>
          <Story />
        </MockedWebContainerProvider>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story: `
This story shows the RequestRelayDemo with mock data to demonstrate how it looks 
when WebContainer servers are actively running on multiple ports.

The mock data includes:
- Port 3000: Typical development server
- Port 5173: Vite development server
- Port 8080: Alternative development server

This allows you to see the full interface and test the proxy URL generation 
without needing to actually start WebContainer servers.
        `,
      },
    },
  },
};

export const Loading: Story = {
  args: {},
  decorators: [
    (Story) => {
      const MockedWebContainerProvider = ({ children }: { children: React.ReactNode }) => {
        return (
          <div>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <strong>Loading State:</strong> This story shows the component while WebContainer is starting up.
            </div>
            <Story />
          </div>
        );
      };

      return (
        <MockedWebContainerProvider>
          <Story />
        </MockedWebContainerProvider>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the RequestRelayDemo in a loading state, 
showing how it appears while WebContainer is booting up and before 
any development servers have started.
        `,
      },
    },
  },
};