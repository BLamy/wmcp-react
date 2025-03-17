# Storybook Deployment Guide

This guide explains how to deploy your Storybook to GitHub Pages with cross-origin isolation support for SharedArrayBuffer.

## Automatic Deployment to GitHub Pages

This repository is configured to automatically deploy to GitHub Pages when you push to the main branch.

### How It Works

1. A GitHub Actions workflow (`/.github/workflows/storybook.yml`) triggers on push to main
2. The workflow builds Storybook and deploys it to GitHub Pages
3. The service worker approach ensures cross-origin isolation even without server headers

### Manual Workflow Run

You can also manually trigger a deployment from the GitHub Actions tab:

1. Go to the repository on GitHub
2. Click on the "Actions" tab
3. Select the "Deploy Storybook to GitHub Pages" workflow
4. Click "Run workflow"

## Testing Cross-Origin Isolation

After deployment, you can verify that cross-origin isolation is working by:

1. Navigate to your GitHub Pages URL
2. Append `/coi-check.html` to the URL (e.g., `https://yourusername.github.io/your-repo/coi-check.html`)
3. The diagnostic page will show if:
   - Cross-origin isolation is enabled
   - SharedArrayBuffer is available
   - The service worker is registered correctly

## Local Development

To run Storybook locally:

```bash
npm run storybook
```

To build Storybook locally:

```bash
npm run build-storybook
```

## How Cross-Origin Isolation Works

This project uses a service worker approach for cross-origin isolation:

1. We register a service worker (`coi-serviceworker.js`) that adds the required headers:
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`

2. The service worker intercepts navigation requests and adds these headers to responses

3. This ensures SharedArrayBuffer is available, which is required for some advanced features

## Troubleshooting

If you encounter issues with cross-origin isolation:

1. Check the browser console for service worker registration errors
2. Verify your GitHub Pages site is properly configured
3. Try the `/coi-check.html` diagnostic page to identify specific issues
4. Make sure your browser supports service workers (most modern browsers do)

## Required Files

The repository has been configured with the following files to ensure proper cross-origin isolation:

- `.storybook/_headers` - Contains COOP/COEP headers as a fallback
- `.storybook/preview-head.html` - Includes the service worker registration script
- `public/coi-serviceworker.js` - The service worker that enforces cross-origin isolation
- `public/register-coi-sw.js` - Script to register the service worker
- `public/coi-check.html` - Diagnostic page to verify cross-origin isolation

## Hosting Considerations

When hosting Storybook, you need cross-origin isolation for SharedArrayBuffer support. This implementation:

- **GitHub Pages**: Works with our service worker approach
- **Netlify**: Also works with our approach, with added support via `netlify.toml`
- **Vercel**: Supported via our service worker approach
- **Azure Static Web Apps**: Should work with our service worker approach

## Notes

- This approach works without requiring server-side header configuration
- It's compatible with GitHub Pages and other static hosting providers
- The service worker approach is more reliable than relying on HTTP headers alone 