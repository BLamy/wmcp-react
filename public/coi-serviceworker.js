// This file is based on coi-serviceworker
// It ensures cross-origin isolation is properly set up for SharedArrayBuffer support
// Modified for Storybook integration

// Detect if we're in an iframe (Storybook preview)
const isIframe = window !== window.parent;

// You can customize these settings
const coepCredentialless = false;

// Helper to determine if this is a navigation request
function isNavigationRequest(event) {
  return event.request.mode === 'navigate';
}

// Set up the proper headers for cross-origin isolation
let securityHeaders = {
  "Cross-Origin-Embedder-Policy": coepCredentialless ? "credentialless" : "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin"
};

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

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  if (isNavigationRequest(event)) {
    // For navigation requests (loading HTML pages), we need to add headers
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
console.log('Storybook COI ServiceWorker activated'); 