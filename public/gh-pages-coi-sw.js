// GitHub Pages Cross-Origin Isolation Service Worker
// This service worker adds COOP/COEP headers to enable SharedArrayBuffer

// We need to intercept navigation requests and add the necessary headers
const securityHeaders = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin"
};

// Helper to determine if this is a navigation request
function isNavigationRequest(event) {
  return event.request.mode === 'navigate';
}

// Helper to check if this is an HTML response
function isHtmlResponse(response) {
  const contentType = response.headers.get('Content-Type');
  return contentType && contentType.includes('text/html');
}

// Add security headers to the response
function addSecurityHeaders(response) {
  // Only add headers to HTML responses
  if (!isHtmlResponse(response)) {
    return response;
  }

  // Clone the response to modify its headers
  const newHeaders = new Headers(response.headers);
  
  // Add our security headers
  Object.entries(securityHeaders).forEach(([header, value]) => {
    newHeaders.set(header, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// Install event - take control immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('GitHub Pages COI ServiceWorker installed');
});

// Activate event - claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  console.log('GitHub Pages COI ServiceWorker activated');
});

// Fetch event - add headers to navigation requests
self.addEventListener('fetch', (event) => {
  // Only process GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For navigation requests (HTML pages), add security headers
  if (isNavigationRequest(event)) {
    event.respondWith(
      fetch(event.request)
        .then(response => addSecurityHeaders(response))
        .catch(error => {
          console.error('Service worker fetch error:', error);
          return new Response('Network error', { status: 500 });
        })
    );
  }
}); 