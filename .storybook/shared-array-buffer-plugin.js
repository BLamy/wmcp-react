/**
 * Vite plugin to inject SharedArrayBuffer headers and polyfill detection
 */
export default function sharedArrayBufferPlugin() {
  return {
    name: 'shared-array-buffer-plugin',
    
    // Apply headers to all HTML files
    transformIndexHtml(html) {
      // Check if headers are already present
      if (html.includes('Cross-Origin-Opener-Policy')) {
        return html;
      }
      
      // Add headers and detection script
      return html.replace('<head>', `<head>
  <meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin" />
  <meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp" />
  <script>
    // Check if SharedArrayBuffer is available
    window.checkSharedArrayBufferSupport = function() {
      try {
        new SharedArrayBuffer(1);
        console.log('[SAB] SharedArrayBuffer is supported');
        return true;
      } catch (e) {
        console.error('[SAB] SharedArrayBuffer is not supported:', e);
        
        // If SAB is not supported, and we're on GitHub Pages, inject our COI service worker
        if (window.location.hostname.includes('github.io')) {
          console.log('[SAB] Detected GitHub Pages. Attempting to use COI service worker...');
          
          // Register GitHub Pages specific COI service worker
          if ('serviceWorker' in navigator) {
            const swPath = new URL('./gh-pages-coi-sw.js', window.location.origin + window.location.pathname).href;
            navigator.serviceWorker.register(swPath, { 
              scope: window.location.pathname 
            }).then(registration => {
              console.log('[SAB] GitHub Pages COI ServiceWorker registered:', registration.scope);
              
              // If the service worker is installing, reload the page to activate it
              if (!navigator.serviceWorker.controller) {
                console.log('[SAB] Reloading page to activate service worker...');
                window.location.reload();
              }
            }).catch(error => {
              console.error('[SAB] GitHub Pages COI ServiceWorker registration failed:', error);
            });
          }
        }
        
        return false;
      }
    };
    
    // Run check when document loads
    window.addEventListener('DOMContentLoaded', function() {
      window.sabSupported = window.checkSharedArrayBufferSupport();
      
      // Add visual indicator of isolation status
      setTimeout(function() {
        const isolationStatus = document.createElement('div');
        isolationStatus.style.position = 'fixed';
        isolationStatus.style.bottom = '10px';
        isolationStatus.style.right = '10px';
        isolationStatus.style.background = window.crossOriginIsolated ? 'rgba(0, 128, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
        isolationStatus.style.color = 'white';
        isolationStatus.style.padding = '10px';
        isolationStatus.style.borderRadius = '5px';
        isolationStatus.style.fontSize = '14px';
        isolationStatus.style.zIndex = '9999';
        isolationStatus.textContent = window.crossOriginIsolated ? '✓ Cross-Origin Isolated' : '✗ Not Cross-Origin Isolated';
        document.body.appendChild(isolationStatus);
      }, 1000);
    });
  </script>`);
    },
    
    // Modify config
    configResolved(config) {
      // Ensure CORS headers are set in preview server
      if (config.server) {
        config.server.headers = {
          ...config.server.headers,
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
        };
      }
    }
  };
} 