// This script checks if SharedArrayBuffer is available in the current context
(function() {
  try {
    // Try to create a SharedArrayBuffer
    const sab = new SharedArrayBuffer(1);
    console.log('✅ SharedArrayBuffer is available! The headers are correctly configured.');
    
    // Additional information for WebContainer
    console.log('ℹ️ WebContainer should work correctly in this environment.');
  } catch (error) {
    console.error('❌ SharedArrayBuffer is not available!', error);
    console.error('Headers required for SharedArrayBuffer are not properly set:');
    console.error('- Cross-Origin-Opener-Policy: same-origin');
    console.error('- Cross-Origin-Embedder-Policy: require-corp');
  }
})(); 