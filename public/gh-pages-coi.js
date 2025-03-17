// GitHub Pages specific cross-origin isolation service worker

// If the browser supports SharedArrayBuffer we don't need to do anything
if (typeof SharedArrayBuffer !== 'undefined') {
  console.log('SharedArrayBuffer already available, no need for COI service worker');
} else {
  // Check if we're already in a cross-origin isolated context
  if (window.crossOriginIsolated) {
    console.log('Already cross-origin isolated');
  } else {
    console.log('Not cross-origin isolated, using COI service worker');
    
    // This is a GitHub Pages specific solution that works around the header limitations
    const swUrl = new URL('./gh-pages-coi-sw.js', window.location.origin + window.location.pathname);
    
    if ('serviceWorker' in navigator) {
      // Register the service worker with the correct scope for GitHub Pages
      navigator.serviceWorker.register(swUrl.href, {
        // Use the correct scope for GitHub Pages subdirectory deployment
        scope: window.location.pathname
      }).then(registration => {
        console.log('GitHub Pages COI ServiceWorker registered:', registration.scope);
        
        // If the page isn't controlled by the service worker yet, reload to activate it
        if (!navigator.serviceWorker.controller) {
          console.log('Reloading page to activate service worker...');
          window.location.reload();
        }
      }).catch(error => {
        console.error('GitHub Pages COI ServiceWorker registration failed:', error);
      });
    }
  }
}

// Diagnostic function to check isolation status
window.checkCrossOriginIsolation = function() {
  const isIsolated = window.crossOriginIsolated === true;
  const hasSAB = typeof SharedArrayBuffer === 'function';
  
  console.log('Cross-Origin-Isolated:', isIsolated);
  console.log('SharedArrayBuffer available:', hasSAB);
  
  if (hasSAB) {
    try {
      // Try to create a SharedArrayBuffer to verify it works
      const sab = new SharedArrayBuffer(1);
      console.log('Successfully created SharedArrayBuffer');
      return true;
    } catch (e) {
      console.error('Failed to create SharedArrayBuffer:', e);
      return false;
    }
  } else {
    console.warn('SharedArrayBuffer is not available in this context');
    return false;
  }
};

// Check isolation status after page load
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(window.checkCrossOriginIsolation, 1000);
}); 