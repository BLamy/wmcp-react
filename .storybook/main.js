const excludedProps = new Set([
  'id',
  'slot',
  'onCopy',
  'onCut',
  'onPaste',
  'onCompositionStart',
  'onCompositionEnd',
  'onCompositionUpdate',
  'onSelect',
  'onBeforeInput',
  'onInput'
]);

/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: [
    "../stories/**/*.mdx",
    "../stories/**/Chat.stories.@(js|jsx|mjs|ts|tsx)",
    "../stories/**/ModelContextProtocol.stories.@(js|jsx|mjs|ts|tsx)",
    "../stories/**/Webcontainer.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-onboarding",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {
      builder: {
        viteConfigPath: 'vite.config.js',
      },
    },
  },
  docs: {
    autodocs: "tag",
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      compilerOptions: {
        allowSyntheticDefaultImports: false,
        esModuleInterop: false,
      },
      propFilter: (prop) => !prop.name.startsWith('aria-') && !excludedProps.has(prop.name),
    },
  },
  staticDirs: ['../public'],
  async viteFinal(config, { configType }) {
    // Add headers for SharedArrayBuffer support
    if (configType === 'DEVELOPMENT') {
      // Add server configuration 
      config.server = config.server || {};
      config.server.headers = {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      };
    }
    
    // For both DEVELOPMENT and PRODUCTION modes
    // Handle "use client" directives
    config.build = config.build || {};
    config.build.rollupOptions = config.build.rollupOptions || {};
    
    // Handle GitHub Pages deployment - add base path if needed
    if (configType === 'PRODUCTION') {
      // Check for GitHub Pages environment
      const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
      
      if (isGitHubPages) {
        // Get repository name from GitHub context or use a fallback
        const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
        
        if (repositoryName) {
          console.log(`GitHub Pages detected, setting base path to /${repositoryName}/`);
          config.base = `/${repositoryName}/`;
        }
      }
    }
    
    // Add custom Rollup plugin to inject headers into HTML files
    config.plugins = config.plugins || [];

    // Ignore "use client" directive warnings
    config.build.rollupOptions.onwarn = (warning, defaultHandler) => {
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && 
          warning.message.includes('"use client"')) {
        return;
      }
      if (defaultHandler) defaultHandler(warning);
    };
    
    return config;
  },
};
export default config;
