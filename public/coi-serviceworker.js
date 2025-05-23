// This file is based on coi-serviceworker
// It ensures cross-origin isolation is properly set up for SharedArrayBuffer support
// Modified for Storybook integration and enhanced with Request Relay capability

// Detect if we're in an iframe (Storybook preview)
const isIframe = window !== window.parent;

// You can customize these settings
const coepCredentialless = false;

// Request Relay State Management
const portMappings = new Map(); // Port → WebContainer URL mapping
const routingConfig = new Map(); // App patterns → routing rules

// Helper to determine if this is a navigation request
function isNavigationRequest(event) {
  return event.request.mode === 'navigate';
}

// Set up the proper headers for cross-origin isolation
let securityHeaders = {
  "Cross-Origin-Embedder-Policy": coepCredentialless ? "credentialless" : "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin"
};

// Request Relay Functions
function parseRequestForRelay(url) {
  // Parse patterns like: app-3000.yourdomain.com/api/data
  const match = url.hostname.match(/^([^-]+)-(\d+)\.(.+)$/);
  
  if (match) {
    const [, appId, port, domain] = match;
    const portInt = parseInt(port);
    
    if (portMappings.has(portInt)) {
      return {
        shouldRelay: true,
        appId,
        port: portInt,
        targetUrl: portMappings.get(portInt).url,
        originalPath: url.pathname + url.search
      };
    }
  }
  
  return { shouldRelay: false };
}

async function handleRelayRequest(request, routing) {
  const targetUrl = `${routing.targetUrl}${routing.originalPath}`;
  
  // Transform headers
  const headers = new Headers(request.headers);
  headers.set('Host', new URL(routing.targetUrl).host);
  headers.delete('Origin'); // Let browser set appropriate origin
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  const proxiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.body,
    credentials: 'omit'
  });
  
  try {
    const response = await fetch(proxiedRequest);
    return addCorsHeaders(response);
  } catch (error) {
    console.error('Request relay error:', error);
    return new Response('Service Unavailable', { status: 503 });
  }
}

function addCorsHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

// Since service workers cannot change headers, we need to intercept requests
// and respond with our own Response objects with the proper headers
function addSecurityHeaders(response) {
  // We only want to add the headers to HTML responses (for Storybook pages)
  if (!response.headers.get('content-type')?.includes('text/html')) {
    return response;
  }

  // Clone the response to avoid modifying the original
  const newHeaders = new Headers(response.headers);
  
  // Add our security headers
  Object.entries(securityHeaders).forEach(([header, value]) => {
    newHeaders.set(header, value);
  });

  // Return a new response with the modified headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// Install service worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'updatePorts':
      // Update port mappings when WebContainer servers start
      if (data.ports && Array.isArray(data.ports)) {
        data.ports.forEach(({ port, url, appId }) => {
          portMappings.set(port, { url, appId });
          console.log(`Service Worker: Registered port ${port} -> ${url}`);
        });
      }
      break;
    case 'configureRouting':
      // Configure URL patterns for routing
      if (data.pattern && data.config) {
        routingConfig.set(data.pattern, data.config);
        console.log(`Service Worker: Configured routing for ${data.pattern}`);
      }
      break;
    default:
      console.log(`Service Worker: Unknown message type: ${type}`);
  }
});

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if this is a request relay request
  const routing = parseRequestForRelay(url);
  if (routing.shouldRelay) {
    event.respondWith(handleRelayRequest(event.request, routing));
    return;
  }
  
  // Handle navigation requests (loading HTML pages), we need to add headers
  if (isNavigationRequest(event)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => addSecurityHeaders(response))
        .catch((error) => {
          console.error('Fetch error:', error);
          return new Response('Network error', { status: 500 });
        })
    );
  }
});

// Log activation
console.log('Enhanced ServiceWorker activated with COI and Request Relay support'); 