# React Aria Tailwind Starter with Storybook

A starter kit with React Aria Components, Tailwind CSS, and Storybook with cross-origin isolation support.

## Features

- **React Aria Components**: Accessible UI components
- **Tailwind CSS**: Utility-first CSS framework
- **Storybook**: Component development environment
- **Cross-Origin Isolation**: Support for SharedArrayBuffer via service worker
- **GitHub Pages Deployment**: Automated deployment via GitHub Actions

## Getting Started

```bash
# Install dependencies
npm install

# Run Storybook
npm run storybook

# Build Storybook
npm run build-storybook
```

## Cross-Origin Isolation

This project includes a service worker implementation for cross-origin isolation, which is required for SharedArrayBuffer support in browsers. The implementation:

1. Uses a service worker to add the required COOP/COEP headers
2. Works on static hosting platforms like GitHub Pages
3. Includes a diagnostic page to verify functionality

Learn more about the implementation in the [Storybook Deployment Guide](STORYBOOK_DEPLOYMENT.md).

## Setting up GitHub Pages Deployment

This project is configured for automatic deployment to GitHub Pages using GitHub Actions.

### Step 1: Configure GitHub Pages in Repository Settings

1. Go to your repository on GitHub
2. Click on "Settings"
3. Navigate to "Pages" in the sidebar
4. Under "Build and deployment", select "GitHub Actions" as the source

### Step 2: Ensure Your Repository Has the Correct Permissions

1. Go to "Settings" in your repository
2. Navigate to "Actions" → "General" in the sidebar
3. In the "Workflow permissions" section, ensure "Read and write permissions" is selected
4. Check "Allow GitHub Actions to create and approve pull requests"
5. Click "Save"

### Step 3: Trigger the Initial Deployment

You can trigger a deployment in two ways:

1. **Push to the main branch**:
   ```bash
   git add .
   git commit -m "Initial setup for GitHub Pages"
   git push origin main
   ```

2. **Manually trigger the workflow**:
   - Go to the "Actions" tab in your repository
   - Select the "Deploy Storybook to GitHub Pages" workflow
   - Click on "Run workflow" → "Run workflow"

### Step 4: Access Your Deployed Storybook

Once the workflow has completed successfully:

1. Go to "Settings" → "Pages"
2. You'll see a message indicating "Your site is live at https://yourusername.github.io/your-repo-name/"
3. Visit that URL to see your deployed Storybook
4. Visit "/coi-check.html" to verify that cross-origin isolation is working

## Testing Cross-Origin Isolation

After deployment, you can verify that cross-origin isolation is working by navigating to the `/coi-check.html` page on your deployed site.

## License

See [LICENSE](LICENSE) for details. 