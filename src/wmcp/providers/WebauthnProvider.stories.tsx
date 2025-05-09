import React, { useState, Suspense, useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { WebauthnProvider, useWebauthn } from './WebauthnProvider';
import useEncryptedLocalStorage from '../hooks/useEncryptedLocalStorage';

// Define the Meta object for the story
const meta = {
  title: 'security/SecureFormProvider',
  component: WebauthnProvider,
  tags: ['autodocs'], // This enables automatic documentation
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# SecureFormProvider

A React context provider that leverages WebAuthn (passkeys) for secure authentication and encryption of sensitive data.

## Features

- **WebAuthn Authentication**: Passwordless authentication using device biometrics or security keys
- **Encryption Key Derivation**: Automatically derives a CryptoKey from the user's passkey
- **Data Encryption**: Securely encrypts data before storing in localStorage
- **Lazy Loading**: Option to only require authentication when accessing protected data
- **Strict Mode**: Option to require authentication before any content is shown
- **Form Data Management**: Built-in hooks for managing encrypted form data

## Installation

Make sure your project has the necessary WebAuthn dependencies:

\`\`\`bash
npm install @simplewebauthn/browser
\`\`\`

## Basic Usage

Wrap your components with \`SecureFormProvider\` to enable authentication and encryption:

\`\`\`jsx
import { SecureFormProvider, useSecureForm } from '@/wmcp/providers/SecureFormProvider';

function MyApp() {
  return (
    <SecureFormProvider
      storageKey="my-secure-app"
      fallback={({ login, error, isLoading }) => (
        <LoginScreen 
          onLogin={login} 
          error={error} 
          isLoading={isLoading} 
        />
      )}
    >
      <MyProtectedApp />
    </SecureFormProvider>
  );
}

function MyProtectedApp() {
  const { encryptionKey, logout } = useSecureForm();
  
  return (
    <div>
      <h1>Protected Content</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
\`\`\`

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| \`storageKey\` | string | Yes | Unique identifier for storing encrypted data in localStorage |
| \`fallback\` | function | Yes | Component to render when user is not authenticated |
| \`children\` | ReactNode or function | Yes | Content to render when authenticated |
| \`strictMode\` | boolean | No | When true, always shows fallback until authenticated |
| \`initialValues\` | object | No | Default values to encrypt on first registration |
| \`forceShowFallback\` | boolean | No | Force showing the fallback component |

## Fallback Render Props

The fallback function receives these props:

| Prop | Type | Description |
|------|------|-------------|
| \`submit\` | function | Submit form data and encrypt it |
| \`login\` | function | Trigger WebAuthn authentication |
| \`error\` | string | Authentication error message, if any |
| \`isLoading\` | boolean | Loading state for authentication operations |

## useSecureForm Hook API

Access the secure context anywhere in your component tree:

\`\`\`jsx
const { 
  encryptionKey,      // CryptoKey: The derived encryption key (null if not authenticated)
  isAuthenticated,    // boolean: Whether the user is authenticated
  error,              // string: Any error that occurred
  isLoading,          // boolean: Loading state
  login,              // function: Trigger WebAuthn authentication
  logout,             // function: Log the user out (clears encryption key)
  register,           // function: Register a new passkey
  values,             // object: Decrypted data values
  setValues,          // function: Update and encrypt values
  destroyData,        // function: Delete all encrypted data
  userIdentifier      // string: Unique identifier for the user's passkey
} = useSecureForm();
\`\`\`

## Usage Patterns

### Strict Mode vs. Lazy Mode

- **Strict Mode** (\`strictMode={true}\`): User must authenticate before seeing any content
- **Lazy Mode** (\`strictMode={false}\`): Content is visible, but authentication is required to access secure features

### Storing Encrypted Data

Use the \`setValues\` method to securely store data:

\`\`\`jsx
const { setValues } = useSecureForm();

// Later in your code:
await setValues({ secretKey: 'sensitive-data' });
\`\`\`

### Reading Encrypted Data

Access decrypted data through the \`values\` property:

\`\`\`jsx
const { values } = useSecureForm();
console.log(values?.secretKey); // 'sensitive-data'
\`\`\`

### Security Best Practices

1. Always protect sensitive data with encryption
2. Use \`strictMode={true}\` for highly sensitive applications
3. Handle authentication failures gracefully
4. Provide clear error messages to users
5. Consider enabling auto-destroy after multiple failed attempts
`
      }
    }
  },
} satisfies Meta<typeof WebauthnProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

interface LoginFormProps {
  submit: (values: any) => Promise<void>;
  login: () => Promise<CryptoKey>;
  error?: string;
  isLoading?: boolean;
}

// Simple login form component
const LoginForm: React.FC<LoginFormProps> = ({ submit, login, error, isLoading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  return (
    <div className="p-4 max-w-md mx-auto mt-8 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Login or Register</h2>
      
      {error && (
        <div className="mb-4 p-2 border border-red-300 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={(e) => {
        e.preventDefault();
        submit({ email, password });
      }} className="space-y-4">
        <div>
          <label className="block mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div>
          <label className="block mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Register'}
          </button>
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              login();
            }}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Login'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface Note {
  id: number;
  text: string;
  createdAt: string;
}

// Component that uses the encrypted localStorage hook
const EncryptedNotes: React.FC = () => {
  const [notes, setNotes] = useEncryptedLocalStorage<Note[]>('secure-notes', []);
  const [newNote, setNewNote] = useState('');
  
  const addNote = async () => {
    if (!newNote.trim()) return;
    
    await setNotes([...notes, {
      id: Date.now(),
      text: newNote,
      createdAt: new Date().toISOString()
    }]);
    
    setNewNote('');
  };
  
  const deleteNote = async (id: number) => {
    await setNotes(notes.filter(note => note.id !== id));
  };
  
  return (
    <div>
      <div className="flex mb-4">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a new note..."
          className="flex-1 p-2 border rounded-l"
        />
        <button
          onClick={addNote}
          className="px-4 py-2 bg-green-500 text-white rounded-r"
        >
          Add
        </button>
      </div>
      
      <ul className="space-y-2">
        {notes.length === 0 ? (
          <li className="text-gray-500 text-center py-4">No notes yet</li>
        ) : (
          notes.map(note => (
            <li key={note.id} className="p-3 bg-white rounded flex justify-between">
              <div>
                <p>{note.text}</p>
                <span className="text-xs text-gray-500">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => deleteNote(note.id)}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

// Standalone component for Suspense demo
const StandaloneNotes: React.FC = () => {
  const { isAuthenticated, login } = useWebauthn();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await login();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isAuthenticated) {
    return (
      <div className="p-4 text-center">
        <p className="mb-4">You need to authenticate to view encrypted notes</p>
        {error && (
          <div className="mb-4 p-2 border border-red-300 bg-red-50 text-red-700 rounded">
            {error}
          </div>
        )}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Authenticating...' : 'Authenticate'}
        </button>
      </div>
    );
  }
  
  return (
    <Suspense fallback={
      <div className="p-4 text-center">
        <div className="animate-pulse">Loading encrypted notes...</div>
      </div>
    }>
      <EncryptedNotes />
    </Suspense>
  );
};

interface SecureFormDemoProps {
  strictMode?: boolean;
}

// Lazy data panel component
const LazyDataPanel: React.FC = () => {
  const { encryptionKey, login, isLoading: contextLoading } = useWebauthn();
  const [showData, setShowData] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleShowData = async () => {
    if (!encryptionKey) {
      setIsLoading(true);
      setError(null);
      try {
        await login();
        setShowData(true);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Authentication failed');
        }
        setShowData(false);
      } finally {
        setIsLoading(false);
      }
    } else {
      setShowData(!showData);
    }
  };
  
  return (
    <div className="mt-4 border rounded p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Form Data</h3>
        <button
          onClick={handleShowData}
          disabled={isLoading || contextLoading}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading || contextLoading ? 'Processing...' : showData ? 'Hide' : 'Reveal'}
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-2 border border-red-300 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {showData && encryptionKey && (
        <FormDataDisplay />
      )}
    </div>
  );
};

// Form data display component
const FormDataDisplay: React.FC = () => {
  const { values } = useWebauthn();
  
  return (
    <div className="p-3 bg-blue-50 rounded">
      <h3 className="font-medium mb-1">Stored Form Data:</h3>
      <pre className="text-xs overflow-x-auto">
        {JSON.stringify(values, null, 2)}
      </pre>
    </div>
  );
};

// Lazy notes component
const LazyNotesPanel: React.FC = () => {
  const { encryptionKey, login, isLoading: contextLoading } = useWebauthn();
  const [showNotes, setShowNotes] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleShowNotes = async () => {
    if (!encryptionKey) {
      setIsLoading(true);
      setError(null);
      try {
        await login();
        setShowNotes(true);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Authentication failed');
        }
        setShowNotes(false);
      } finally {
        setIsLoading(false);
      }
    } else {
      setShowNotes(!showNotes);
    }
  };
  
  return (
    <div className="mt-4 border rounded p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Encrypted Notes</h3>
        <button
          onClick={handleShowNotes}
          disabled={isLoading || contextLoading}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading || contextLoading ? 'Processing...' : showNotes ? 'Hide' : 'Reveal'}
        </button>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        {showNotes 
          ? 'Notes are decrypted and visible'
          : 'Click "Reveal" to decrypt and show your notes'}
      </p>
      
      {error && (
        <div className="mb-4 p-2 border border-red-300 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {showNotes && encryptionKey && (
        <Suspense fallback={
          <div className="p-4 text-center">
            <div className="animate-pulse">Loading encrypted notes...</div>
          </div>
        }>
          <EncryptedNotes />
        </Suspense>
      )}
    </div>
  );
};

// Main demo component
const SecureFormDemo: React.FC<SecureFormDemoProps> = ({ strictMode = false }) => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">
        Secure Form Provider Demo
        {strictMode ? ' (Strict Mode)' : ' (Lazy Mode)'}
      </h1>
      
      <p className="mb-4 text-gray-700">
        {strictMode 
          ? 'In strict mode, authentication is required before accessing any content.' 
          : 'In lazy mode, authentication is only required when accessing encrypted data.'}
      </p>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">How it works</h2>
        <ul className="list-disc ml-5 space-y-1 text-gray-600">
          <li>Uses WebAuthn for passwordless authentication</li>
          <li>Derives an encryption key from your passkey</li>
          <li>Encrypts sensitive data before storing in localStorage</li>
          <li>Supports React Suspense for loading states</li>
          <li>In lazy mode, passkey is only requested when needed</li>
        </ul>
      </div>
      
      <WebauthnProvider
        storageKey="storybook-demo"
        strictMode={strictMode}
        // Important: Set this to prevent auto-decryption in lazy mode
        forceShowFallback={false}
        fallback={({ submit, login, error, isLoading }) => (
          <LoginForm
            submit={submit}
            login={login}
            error={error}
            isLoading={isLoading}
          />
        )}
      >
        {(context) => (
          <div className="bg-white shadow rounded p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Welcome!</h2>
              <button
                onClick={context.logout}
                className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded"
              >
                Logout
              </button>
            </div>
            
            <p className="mb-4">User ID: {context.userIdentifier?.slice(0, 8)}...</p>
            
            {/* Lazily decrypt and display form data */}
            <LazyDataPanel />
            
            {/* Lazily decrypt and display notes */}
            <LazyNotesPanel />
            
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-lg font-medium mb-2">Advanced Actions</h3>
              <div className="flex space-x-2">
                <button
                  onClick={context.destroyData}
                  className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Destroy All Data
                </button>
              </div>
            </div>
          </div>
        )}
      </WebauthnProvider>
    </div>
  );
};

// Story: Lazy Mode (default)
export const LazyMode: Story = {
  args: {
    storageKey: "storybook-demo-lazy",
    forceShowFallback: false,
    strictMode: false,
    fallback: (props) => (
      <LoginForm
        submit={props.submit}
        login={props.login}
        error={props.error}
        isLoading={props.isLoading}
      />
    ),
    children: (context) => <SecureFormDemo strictMode={false} />
  }
};

// Story: Strict Mode
export const StrictMode: Story = {
  args: {
    storageKey: "storybook-demo-strict",
    forceShowFallback: false,
    strictMode: true,
    fallback: (props) => (
      <LoginForm
        submit={props.submit}
        login={props.login}
        error={props.error}
        isLoading={props.isLoading}
      />
    ),
    children: (context) => <SecureFormDemo strictMode={true} />
  }
};

// Story: Suspense Demo with self-contained authentication
export const SuspenseDemo: Story = {
  args: {
    storageKey: "suspense-demo",
    fallback: ({ submit, login, error, isLoading }) => (
      <LoginForm
        submit={submit}
        login={login}
        error={error}
        isLoading={isLoading}
      />
    ),
    children: (
      <div className="bg-white shadow rounded p-4">
        <h2 className="text-xl font-semibold mb-4">Notes App</h2>
        <StandaloneNotes />
      </div>
    )
  },
  // Using decorators to wrap the component with additional UI elements
  decorators: [
    (Story) => (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Encrypted LocalStorage with Suspense</h1>
        
        <div className="mb-4 p-3 bg-blue-50 rounded">
          <p>This demo has its own authentication flow and doesn't rely on other demos.</p>
          <p>The notes data is only fetched when authentication is complete.</p>
        </div>
        
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      story: {
        inline: true
      }
    }
  }
};
