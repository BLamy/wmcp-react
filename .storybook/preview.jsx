import '../src/index.css';
import React from 'react';
// import { withThemeByClassName } from '@storybook/addon-themes';
import WebContainerProvider from '../src/wmcp/providers/Webcontainer';

// Add SharedArrayBuffer check banner
const withSharedArrayBufferCheck = (Story) => {
  const [isSupported, setIsSupported] = React.useState(null);
  
  React.useEffect(() => {
    // Check if SharedArrayBuffer is available
    try {
      // eslint-disable-next-line no-new
      new SharedArrayBuffer(1);
      setIsSupported(true);
    } catch (e) {
      setIsSupported(false);
      console.error('SharedArrayBuffer is not available. This is required for WebContainer to work.');
      console.error('Make sure the correct COOP and COEP headers are set.');
    }
  }, []);
  
  if (isSupported === null) {
    return <div>Checking SharedArrayBuffer support...</div>;
  }
  
  return (
    <>
      {!isSupported && (
        <div style={{
          background: '#FEF2F2',
          color: '#B91C1C',
          padding: '12px 16px',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px',
          fontFamily: 'sans-serif',
        }}>
          <strong>Warning:</strong> SharedArrayBuffer is not available. WebContainer will not work.
          <br />
          <span style={{ fontSize: '12px' }}>
            Set the following headers on your server:
            <code style={{ 
              display: 'block', 
              marginTop: '8px', 
              padding: '8px', 
              background: 'rgba(0,0,0,0.1)',
              borderRadius: '4px' 
            }}>
              Cross-Origin-Opener-Policy: same-origin<br />
              Cross-Origin-Embedder-Policy: require-corp
            </code>
          </span>
        </div>
      )}
      <Story />
    </>
  );
};

// Add WebContainer progress info
const withWebContainerStatus = (Story) => {
  const [status, setStatus] = React.useState('initializing');
  const [message, setMessage] = React.useState('Preparing WebContainer environment...');
  
  React.useEffect(() => {
    const checkWebContainer = () => {
      if (window.webcontainer) {
        setStatus('ready');
        setMessage('WebContainer is ready');
        return true;
      }
      return false;
    };
    
    // Check immediately
    if (checkWebContainer()) return;
    
    // Set up polling to check for WebContainer
    const interval = setInterval(() => {
      if (checkWebContainer()) {
        clearInterval(interval);
      }
    }, 500);
    
    // Set a timeout to give up after 30 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!window.webcontainer) {
        setStatus('error');
        setMessage('WebContainer initialization timed out after 30 seconds');
      }
    }, 30000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);
  
  return (
    <>
      {status !== 'ready' && (
        <div style={{
          background: status === 'error' ? '#FEF2F2' : '#EFF6FF',
          color: status === 'error' ? '#B91C1C' : '#1E40AF',
          padding: '12px 16px',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px',
          fontFamily: 'sans-serif',
          display: 'flex',
          alignItems: 'center',
        }}>
          {status === 'initializing' && (
            <div style={{ 
              width: '16px', 
              height: '16px', 
              borderRadius: '50%', 
              borderWidth: '2px', 
              borderStyle: 'solid',
              borderColor: '#1E40AF #1E40AF #1E40AF transparent',
              marginRight: '12px',
              animation: 'spin 1s linear infinite',
            }} />
          )}
          {message}
        </div>
      )}
      <Story />
    </>
  );
};

// Provide a single WebContainer instance to all stories
const withWebContainerProvider = (Story) => {
  return (
    <WebContainerProvider>
      <Story />
    </WebContainerProvider>
  );
};

/** @type { import('@storybook/react').Preview } */
const preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    }
  },

  decorators: [
    withSharedArrayBufferCheck,
    // withWebContainerStatus,
    withWebContainerProvider,
    // withThemeByClassName({
    //   themes: {
    //     light: '',
    //     dark: 'dark',
    //   },
    //   defaultTheme: 'light',
    // }),
  ],
};

export default preview; 