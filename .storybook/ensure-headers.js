/**
 * This script ensures all HTML files in the build directory have 
 * the proper headers for SharedArrayBuffer support
 */

const fs = require('fs');
const path = require('path');

// Directory containing built files
const buildDir = path.resolve(__dirname, '../storybook-static');

// Helper to check if a file is HTML
const isHtmlFile = (filename) => filename.endsWith('.html');

// Service worker files to copy from public to build dir
const serviceWorkerFiles = [
  'gh-pages-coi.js',
  'gh-pages-coi-sw.js',
];

// Headers meta tags to insert
const headersTags = `
  <meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin" />
  <meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp" />
`;

// GitHub Pages service worker script to inject
const serviceWorkerScript = `
  <script>
    // Check if we're on GitHub Pages and need the service worker
    if (window.location.hostname.includes('github.io') && typeof SharedArrayBuffer === 'undefined') {
      console.log('GitHub Pages detected, loading COI service worker...');
      
      // Register the service worker
      if ('serviceWorker' in navigator) {
        const swPath = new URL('./gh-pages-coi-sw.js', window.location.origin + window.location.pathname).href;
        navigator.serviceWorker.register(swPath, { 
          scope: window.location.pathname 
        }).then(registration => {
          console.log('GitHub Pages COI ServiceWorker registered:', registration.scope);
          
          // If the service worker is installing, reload the page to activate it
          if (!navigator.serviceWorker.controller) {
            console.log('Reloading page to activate service worker...');
            window.location.reload();
          }
        }).catch(error => {
          console.error('GitHub Pages COI ServiceWorker registration failed:', error);
        });
      }
    }
  </script>
`;

// Process all HTML files in the build directory
function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Recursively process subdirectories
      processDirectory(filePath);
    } else if (isHtmlFile(file)) {
      // Process HTML file
      addHeadersToHtmlFile(filePath);
    }
  });
}

// Add headers to HTML file if they don't exist
function addHeadersToHtmlFile(filePath) {
  console.log(`Processing ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Only add headers if they don't already exist
  if (!content.includes('Cross-Origin-Opener-Policy')) {
    content = content.replace('<head>', `<head>${headersTags}`);
    console.log(`  - Added headers to ${path.basename(filePath)}`);
  } else {
    console.log(`  - Headers already exist in ${path.basename(filePath)}`);
  }
  
  // Add the service worker script for GitHub Pages if not already present
  if (!content.includes('gh-pages-coi-sw.js') && !content.includes('github.io')) {
    content = content.replace('</head>', `${serviceWorkerScript}</head>`);
    console.log(`  - Added GitHub Pages service worker to ${path.basename(filePath)}`);
  }
  
  fs.writeFileSync(filePath, content);
}

// Copy service worker files to the build directory
function copyServiceWorkerFiles() {
  serviceWorkerFiles.forEach(file => {
    const sourcePath = path.resolve(__dirname, '../public', file);
    const destPath = path.resolve(buildDir, file);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${file} to build directory`);
    } else {
      console.error(`Error: Service worker file ${file} not found in public directory`);
    }
  });
}

// Start processing
console.log('Ensuring headers in HTML files...');
copyServiceWorkerFiles();
processDirectory(buildDir);
console.log('Done!'); 