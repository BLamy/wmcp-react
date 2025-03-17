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
        return false;
      }
    };
    
    // Run check when document loads
    window.addEventListener('DOMContentLoaded', function() {
      window.sabSupported = window.checkSharedArrayBufferSupport();
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