// Script to register the coi-serviceworker
(function() {
  // Detect if we're in an iframe (Storybook preview) and adjust paths as needed
  const isIframe = window !== window.parent;
  const iframePathAdjustment = isIframe ? '../' : '';
  
  // Only register if SharedArrayBuffer is not available - this prevents unnecessary registration
  if (typeof SharedArrayBuffer !== 'function') {
    console.log('SharedArrayBuffer not detected, registering COI service worker...');
    
    // Use our custom service worker instead of the npm package one
    const swPath = `${iframePathAdjustment}coi-serviceworker.js`;
    
    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
      // Register the service worker
      navigator.serviceWorker.register(swPath, {
        // The scope determines which resources the service worker can control
        scope: './'
      }).then(registration => {
        console.log('COI ServiceWorker registered with scope:', registration.scope);
      }).catch(error => {
        console.error('COI ServiceWorker registration failed:', error);
      });
    } else {
      console.warn('Service workers are not supported in this browser');
    }
  } else {
    console.log('SharedArrayBuffer already available, no need for COI service worker');
  }
  
  // Add diagnostic information to help debug cross-origin isolation
  window.checkCrossOriginIsolation = function() {
    console.log('Cross-Origin-Isolated:', window.crossOriginIsolated);
    console.log('SharedArrayBuffer available:', typeof SharedArrayBuffer === 'function');
    
    try {
      // Try to create a SharedArrayBuffer to verify it works
      const sab = new SharedArrayBuffer(1);
      console.log('Successfully created SharedArrayBuffer');
      return true;
    } catch (e) {
      console.error('Failed to create SharedArrayBuffer:', e);
      return false;
    }
  };
  
  // Check isolation status after page load
  window.addEventListener('DOMContentLoaded', function() {
    window.setTimeout(window.checkCrossOriginIsolation, 1000);
  });
})(); 