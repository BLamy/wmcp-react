#!/usr/bin/env node

// Use dynamic import for isomorphic-git to ensure ES module compatibility
let git: any;

// Import fs using a more ES module friendly approach
import * as fs from 'fs';

const command = process.argv[2];
const args = process.argv.slice(3);

// Helper function to dynamically import the http module when needed
async function getHttp() {
  return (await import('isomorphic-git/http/node/index.js')).default;
}

async function main() {
  // Dynamically import isomorphic-git at runtime
  git = (await import('isomorphic-git')).default;
  
  const dir = process.cwd();

  try {
    switch (command) {
      case 'init':
        await git.init({ fs, dir });
        console.log('Initialized empty Git repository');
        break;

      case 'add':
        const filepath = args[0] || '.';
        await git.add({ fs, dir, filepath });
        console.log(`Added ${filepath} to staging area`);
        break;

      case 'commit':
        if (!args[0]) {
          console.error('Please provide a commit message');
          process.exit(1);
        }
        const sha = await git.commit({
          fs,
          dir,
          message: args[0],
          author: {
            name: 'WebContainer User',
            email: 'user@webcontainer.local'
          }
        });
        console.log(`Created commit ${sha}`);
        break;

      case 'clone':
        const url = args[0];
        if (!url) {
          console.error('Please provide a repository URL to clone');
          break;
        }
        
        console.log(`Cloning ${url}...`);
        try {
          const http = await getHttp();
          await git.clone({
            fs,
            http,
            dir,
            url,
            singleBranch: true,
            depth: 1
          });
          console.log('Cloned successfully');
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error('Clone failed:', err.message);
        }
        break;

      case 'pull':
        try {
          const http = await getHttp();
          await git.pull({
            fs,
            http,
            dir,
            author: {
              name: 'WebContainer User',
              email: 'user@example.com'
            }
          });
          console.log('Pull completed successfully');
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error('Pull failed:', err.message);
        }
        break;

      case 'push':
        const pushUrl = args[0];
        if (!pushUrl) {
          console.error('Please provide a repository URL to push to');
          break;
        }
        
        const remoteName = args[1] || 'origin';
        const branch = args[2] || 'main';
        
        try {
          const http = await getHttp();
          await git.push({
            fs,
            http,
            dir,
            url: pushUrl,
            remote: remoteName,
            ref: branch,
            force: false
          });
          console.log('Push completed successfully');
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error('Push failed:', err.message);
        }
        break;

      case 'rebase':
        if (!args[0]) {
          console.error('Please provide a branch name to rebase onto');
          process.exit(1);
        }
        const onto = args[0];
        console.log(`Checking out ${onto} and merging changes...`);
        
        // First save the current branch
        const currentBranch = await git.currentBranch({ fs, dir });
        if (!currentBranch) {
          console.error('Could not determine current branch');
          process.exit(1);
        }
        
        // Save current changes to a temporary branch
        const tempBranch = `temp-${Date.now()}`;
        await git.branch({ fs, dir, ref: tempBranch });
        
        // Checkout the target branch
        await git.checkout({
          fs,
          dir,
          ref: onto
        });
        console.log(`Checked out ${onto}`);
        
        // Merge the temporary branch
        await git.merge({
          fs,
          dir,
          theirs: tempBranch,
          author: {
            name: 'WebContainer User',
            email: 'user@webcontainer.local'
          }
        });
        console.log('Merge completed (rebase alternative)');
        
        // Delete the temporary branch
        await git.deleteBranch({ fs, dir, ref: tempBranch });
        break;

      case 'status':
        const status = await git.statusMatrix({ fs, dir });
        const fileStatuses = status.map(([filepath, head, workdir, stage]: [string, number, number, number]) => {
          let status = '';
          if (head === 0 && workdir === 2) status = 'added';
          if (head === 1 && workdir === 2) status = 'modified';
          if (head === 1 && workdir === 0) status = 'deleted';
          if (head === 1 && stage === 2) status = 'staged';
          return `${status.padEnd(10)} ${filepath}`;
        });
        console.log(fileStatuses.join('\n'));
        break;

      case 'log':
        const commits = await git.log({ fs, dir });
        commits.forEach((commit: { oid: string; commit: { message: string } }) => {
          console.log(`commit ${commit.oid}\n${commit.commit.message}\n`);
        });
        break;

      case 'diff':
        // Parse options
        let diffFilePath = args[0] || '.';
        let oldRef = 'HEAD';
        let newRef = null; // null means working directory
        
        // If a second argument is provided, use it as the comparison ref
        if (args[1]) {
          if (args[0] === '--cached' || args[0] === '--staged') {
            // Handle diff between HEAD and index
            oldRef = 'HEAD';
            newRef = 'STAGE';
            // No file path specified in this case
          } else {
            // Comparing two refs
            oldRef = args[0];
            newRef = args[1];
            // If there's a third argument, it's the file path
            if (args[2]) diffFilePath = args[2];
          }
        } else if (diffFilePath === '--cached' || diffFilePath === '--staged') {
          // Handle showing staged changes
          oldRef = 'HEAD';
          newRef = 'STAGE';
          diffFilePath = '.';
        }
        
        try {
          // Get the changes
          const statusMatrix = await git.statusMatrix({ fs, dir, filepaths: [diffFilePath] });
          
          for (const [filepath, head, workdir, stage] of statusMatrix) {
            // Skip unchanged files
            if (head === workdir && head === stage) continue;
            
            let oldContent = '';
            let newContent = '';
            
            // Get old content
            try {
              if (head !== 0) { // File exists in HEAD
                const oldCommit = await git.resolveRef({ fs, dir, ref: oldRef });
                const { blob } = await git.readBlob({
                  fs,
                  dir,
                  oid: oldCommit,
                  filepath
                });
                oldContent = Buffer.from(blob).toString('utf8');
              }
            } catch (error) {
              // File might not exist in the old ref
            }
            
            // Get new content
            try {
              if (newRef === 'STAGE' && stage !== 0) {
                // Get staged content
                const fileContent = await fs.promises.readFile(`${dir}/${filepath}`);
                const { oid } = await git.hashBlob({ 
                  object: fileContent
                });
                const { blob } = await git.readBlob({
                  fs,
                  dir,
                  oid,
                  filepath
                });
                newContent = Buffer.from(blob).toString('utf8');
              } else if (newRef === null && workdir !== 0) {
                // Get working directory content
                newContent = await fs.promises.readFile(`${dir}/${filepath}`, 'utf8');
              } else if (newRef && newRef !== 'STAGE') {
                // Get content from specific ref
                const newCommit = await git.resolveRef({ fs, dir, ref: newRef });
                const { blob } = await git.readBlob({
                  fs,
                  dir,
                  oid: newCommit,
                  filepath
                });
                newContent = Buffer.from(blob).toString('utf8');
              }
            } catch (error) {
              // File might not exist in the new ref
            }
            
            // Simple text diff output
            console.log(`diff --git a/${filepath} b/${filepath}`);
            if (head === 0) {
              console.log(`new file mode 100644`);
            } else if (workdir === 0 || stage === 0) {
              console.log(`deleted file mode 100644`);
            }
            console.log(`--- a/${filepath}`);
            console.log(`+++ b/${filepath}`);
            
            // Display basic line-by-line diff
            const oldLines = oldContent.split('\n');
            const newLines = newContent.split('\n');
            
            // Super simple diff algorithm for demonstration
            // In a real implementation, you'd use a proper diff algorithm
            let lineNumber = 1;
            
            if (head === 0) {
              // New file
              newLines.forEach(line => {
                console.log(`+${line}`);
              });
            } else if (workdir === 0 || stage === 0) {
              // Deleted file
              oldLines.forEach(line => {
                console.log(`-${line}`);
              });
            } else {
              // Modified file - basic line comparison
              const maxLines = Math.max(oldLines.length, newLines.length);
              for (let i = 0; i < maxLines; i++) {
                const oldLine = i < oldLines.length ? oldLines[i] : '';
                const newLine = i < newLines.length ? newLines[i] : '';
                
                if (oldLine !== newLine) {
                  if (i < oldLines.length) console.log(`-${oldLine}`);
                  if (i < newLines.length) console.log(`+${newLine}`);
                } else {
                  console.log(` ${oldLine}`);
                }
              }
            }
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error('Diff failed:', err.message);
        }
        break;

      default:
        console.log(`
Available commands:
  init                    Initialize a new git repository
  add [<path>]           Add file contents to the staging area
  commit -m <message>    Record changes to the repository
  status                 Show the working tree status
  log                    Show commit logs
  clone <url> [<ref>]    Clone a repository into a new directory
  pull                   Fetch from and integrate with another repository
  push <url>            Update remote refs along with associated objects
  rebase <branch>       Reapply commits on top of another base tip
  diff [<options>] [<path>]  Show changes between commits, commit and working tree, etc
`);
        break;
    }
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();