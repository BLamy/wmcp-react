import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export default function webcontainerFilesPlugin() {
  const virtualModuleId = 'virtual:webcontainer-files';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'webcontainer-files',
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        const rootDir = process.cwd();
        const webcontainerDir = resolve(rootDir, 'src/wmcp/webcontainer-files');
        const filesTree = {};

        console.log(`[webcontainer-files plugin] Loading files from: ${webcontainerDir}`);
        
        try {
          if (!existsSync(webcontainerDir)) {
            console.error(`[webcontainer-files plugin] Directory does not exist: ${webcontainerDir}`);
            return `export const files = {};`;
          }

          function readDirRecursive(dir, currentTree) {
            console.log(`[webcontainer-files plugin] Reading directory: ${dir}`);
            const entries = readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
              const fullPath = join(dir, entry.name);
              
              if (entry.isDirectory()) {
                // Create directory node
                currentTree[entry.name] = { directory: {} };
                // Continue recursion with the directory's contents
                readDirRecursive(fullPath, currentTree[entry.name].directory);
              } else {
                // Create file node
                const contents = readFileSync(fullPath, 'utf-8');
                currentTree[entry.name] = {
                  file: {
                    contents
                  }
                };
                console.log(`[webcontainer-files plugin] Added file: ${entry.name}`);
              }
            }
          }

          readDirRecursive(webcontainerDir, filesTree);
          
          console.log(`[webcontainer-files plugin] Generated filesTree with ${Object.keys(filesTree).length} entries`);
          return `export const files = ${JSON.stringify(filesTree, null, 2)};`;
        } catch (error) {
          console.error(`[webcontainer-files plugin] Error loading files:`, error);
          return `export const files = {}; // Error: ${error.message}`;
        }
      }
    },
    configureServer(server) {
      // Watch for changes in the webcontainer directory
      const rootDir = process.cwd();
      server.watcher.add(resolve(rootDir, 'src/wmcp/webcontainer-files/**/*'));
    }
  };
}
