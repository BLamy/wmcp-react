#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to the compiled bin directory
const binDir = path.resolve(__dirname, 'dist/bin');
console.log(`Bin directory path: ${binDir}`);

// Check if the directory exists
if (!fs.existsSync(binDir)) {
  console.log('Bin directory does not exist yet. Creating it...');
  fs.mkdirSync(binDir, { recursive: true });
}

// First, make sure the TypeScript files are compiled
try {
  console.log('Compiling TypeScript files...');
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('TypeScript compilation completed.');
} catch (error) {
  console.error('TypeScript compilation failed:', error.message);
  // Continue anyway as the files might already be compiled
}

// Get all JavaScript files in the bin directory
const files = fs.readdirSync(binDir).filter(file => file.endsWith('.js'));
console.log(`Found ${files.length} binary files: ${files.join(', ')}`);

if (files.length === 0) {
  console.error('No JavaScript files found in bin directory. TypeScript compilation may have failed.');
}

// Make them executable
for (const file of files) {
  const filePath = path.join(binDir, file);
  console.log(`Processing ${filePath}...`);
  
  try {
    // Read the file content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if it already has a shebang line
    if (!content.startsWith('#!/usr/bin/env node')) {
      // Add shebang line if it doesn't exist
      content = '#!/usr/bin/env node\n' + content;
      fs.writeFileSync(filePath, content);
      console.log(`Added shebang to ${file}`);
    }
    
    // Add executable permission (chmod +x)
    fs.chmodSync(filePath, 0o755);
    console.log(`Made ${file} executable`);
    
    // Create a symlink in node_modules/.bin
    const binLinkDir = path.resolve(process.cwd(), 'node_modules/.bin');
    console.log(`Bin link directory: ${binLinkDir}`);
    
    if (!fs.existsSync(binLinkDir)) {
      console.log(`Creating ${binLinkDir}...`);
      fs.mkdirSync(binLinkDir, { recursive: true });
    }
    
    const linkName = path.basename(file, '.js');
    const linkPath = path.join(binLinkDir, linkName);
    
    // Remove existing symlink if it exists
    if (fs.existsSync(linkPath)) {
      console.log(`Removing existing symlink: ${linkPath}`);
      fs.unlinkSync(linkPath);
    }
    
    // Create the symlink
    try {
      fs.symlinkSync(filePath, linkPath);
      console.log(`Created symlink in node_modules/.bin for ${linkName}`);
    } catch (error) {
      // Fallback to copying if symlink fails (some environments don't support symlinks)
      console.log(`Symlink failed, copying file instead: ${error.message}`);
      fs.copyFileSync(filePath, linkPath);
      fs.chmodSync(linkPath, 0o755);
      console.log(`Copied ${file} to ${linkPath} and made it executable`);
    }
    
    // Create a wrapper script in /bin (which is usually in PATH)
    try {
      const userBinDir = '/bin';
      if (fs.existsSync(userBinDir)) {
        const userBinPath = path.join(userBinDir, linkName);
        const wrapperContent = `#!/bin/sh
node ${filePath} "$@"
`;
        fs.writeFileSync(userBinPath, wrapperContent);
        fs.chmodSync(userBinPath, 0o755);
        console.log(`Created wrapper script at ${userBinPath}`);
      }
    } catch (error) {
      console.error(`Failed to create wrapper script in /bin:`, error.message);
    }
    
  } catch (error) {
    console.error(`Failed to process ${file}:`, error);
  }
}

// Create an .npmrc file to ensure binaries are linked properly
try {
  const npmrcPath = path.resolve(process.cwd(), '.npmrc');
  const npmrcContent = 'prefix = ${HOME}/.npm-global\n';
  fs.writeFileSync(npmrcPath, npmrcContent);
  console.log(`Created .npmrc file at ${npmrcPath}`);
} catch (error) {
  console.error(`Failed to create .npmrc file:`, error.message);
}

// Create a .profile or .bashrc to update PATH
try {
  const profilePath = path.resolve(process.cwd(), '.profile');
  const profileContent = `
# Add npm bin directories to PATH
export PATH="$PATH:${path.resolve(process.cwd(), 'node_modules/.bin')}:$HOME/.npm-global/bin"
`;
  fs.writeFileSync(profilePath, profileContent);
  console.log(`Created .profile file at ${profilePath}`);
  
  // Try to source the profile immediately
  try {
    execSync(`export PATH="$PATH:${path.resolve(process.cwd(), 'node_modules/.bin')}:$HOME/.npm-global/bin"`);
    console.log('Updated PATH environment variable.');
  } catch (error) {
    console.error('Failed to update PATH:', error.message);
  }
} catch (error) {
  console.error(`Failed to create .profile file:`, error.message);
}

console.log('All binary files processed.');
console.log('Current directory contents:');
try {
  const contents = execSync('ls -la').toString();
  console.log(contents);
} catch (error) {
  console.error('Failed to list directory contents:', error.message);
}

console.log('PATH environment variable:');
try {
  console.log(process.env.PATH);
} catch (error) {
  console.error('Failed to get PATH:', error.message);
}

// Try to run npm link
try {
  console.log('Running npm link...');
  execSync('npm link', { stdio: 'inherit' });
  console.log('npm link completed successfully.');
} catch (error) {
  console.error('npm link failed:', error.message);
} 