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

// Headers meta tags to insert
const headersTags = `
  <meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin" />
  <meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp" />
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
    fs.writeFileSync(filePath, content);
    console.log(`  - Added headers to ${path.basename(filePath)}`);
  } else {
    console.log(`  - Headers already exist in ${path.basename(filePath)}`);
  }
}

// Start processing
console.log('Ensuring headers in HTML files...');
processDirectory(buildDir);
console.log('Done!'); 