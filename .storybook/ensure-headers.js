/**
 * This script ensures all HTML files in the build directory have 
 * the proper headers for SharedArrayBuffer support
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildDir = path.resolve(__dirname, '../storybook-static');

// Copy coi-serviceworker from node_modules
const coiServiceworkerPath = path.resolve(__dirname, '../node_modules/coi-serviceworker/coi-serviceworker.js');
fs.copyFileSync(coiServiceworkerPath, path.join(buildDir, 'coi-serviceworker.js'));

// Headers to add
const headersTags = `
  <meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin" />
  <meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp" />
`;

// Service worker registration script
const serviceWorkerScript = `
  <script src="./coi-serviceworker.js"></script>
`;

// Process HTML files
function processHtmlFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('Cross-Origin-Opener-Policy')) {
    content = content.replace('<head>', `<head>${headersTags}`);
  }
  
  if (!content.includes('coi-serviceworker.js')) {
    content = content.replace('</head>', `${serviceWorkerScript}</head>`);
  }
  
  fs.writeFileSync(filePath, content);
}

// Process all HTML files
fs.readdirSync(buildDir)
  .filter(file => file.endsWith('.html'))
  .forEach(file => processHtmlFile(path.join(buildDir, file))); 