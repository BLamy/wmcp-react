import React, { useState, useCallback, useRef } from 'react';
import { KeyRound, Shield, ShieldCheck, AlertCircle } from 'lucide-react';
import { startRegistration, startAuthentication, WebAuthnError } from '../lib/webauthn';
import { deriveKey, encryptData, decryptData } from '../lib/utils';
import { LexicalEditor, LexicalEditorRef } from './lexical/LexicalEditor';

export interface SecureNotesDemoProps {
  initialEmail?: string;
}

export function SecureNotesDemo({ initialEmail = '' }: SecureNotesDemoProps) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<'initial' | 'registered' | 'authenticated'>('initial');
  const [error, setError] = useState<string | null>(null);
  const [plainText, setPlainText] = useState('');
  const [encryptedText, setEncryptedText] = useState('');
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const isDecrypting = useRef(false);
  const editorRef = useRef<LexicalEditorRef>(null);

  const addDebugLog = (message: string) => {
    console.log('Debug:', message);
    setDebug(prev => [...prev, message]);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const credential = await startRegistration(email);
      console.log('Registration successful:', credential);
      setStatus('registered');
    } catch (err) {
      setError(err instanceof WebAuthnError ? err.message : 'Registration failed');
    }
  };

  const handleAuthenticate = async () => {
    try {
      setError(null);
      const assertion = await startAuthentication();
      console.log('Authentication successful:', assertion);
      setStatus('authenticated');
      
      // Derive and cache the encryption key
      const key = await deriveKey(new TextEncoder().encode(assertion.id));
      setEncryptionKey(key);
      addDebugLog('Encryption key derived successfully');
    } catch (err) {
      setError(err instanceof WebAuthnError ? err.message : 'Authentication failed');
    }
  };

  // Handle changes from the Lexical editor (plain text)
  const handlePlainTextChange = useCallback(async (content: string) => {
    if (!encryptionKey || isDecrypting.current) return;
    
    try {
      // Try to parse the content as JSON to check if it's an empty editor state
      const contentObj = JSON.parse(content);
      const root = contentObj.root;
      const isEmpty = root.children.length === 0 || 
        (root.children.length === 1 && 
         root.children[0].children.length === 0 && 
         root.children[0].type === 'paragraph');

      if (isEmpty) {
        setPlainText('');
        setEncryptedText('');
        addDebugLog('Editor is empty, clearing both editors');
        return;
      }

      setDecryptError(null);
      addDebugLog(`Encrypting content: ${content.substring(0, 50)}...`);

      // Only encrypt if we have actual content
      const encrypted = await encryptData(encryptionKey, content);
      setPlainText(content);
      setEncryptedText(encrypted);
      addDebugLog(`Encrypted successfully: ${encrypted.substring(0, 50)}...`);
    } catch (err) {
      console.error('Encryption failed:', err);
      setDecryptError('Failed to encrypt text');
      addDebugLog(`Encryption failed: ${err}`);
    }
  }, [encryptionKey]);

  // Handle changes from the encrypted text textarea
  const handleEncryptedTextChange = useCallback(async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!encryptionKey) return;
    const content = e.target.value.trim();
    setDecryptError(null);
    
    try {
      // If content is empty, clear both editors
      if (!content) {
        setPlainText('');
        setEncryptedText('');
        editorRef.current?.clear();
        addDebugLog('Cleared both editors - empty encrypted text');
        return;
      }

      addDebugLog(`Attempting to decrypt: ${content.substring(0, 50)}...`);
      isDecrypting.current = true; // Set flag before decryption
      
      const decrypted = await decryptData(encryptionKey, content);
      addDebugLog(`Decrypted content: ${decrypted.substring(0, 50)}...`);
      
      // Update both states
      setEncryptedText(content);
      setPlainText(decrypted);
      
      // Update the editor directly
      editorRef.current?.setContent(decrypted);
      
      // Reset the decrypting flag after a short delay
      setTimeout(() => {
        isDecrypting.current = false;
        addDebugLog(`Editor updated with decrypted content`);
      }, 100);
    } catch (err) {
      const error = err as Error;
      console.error('Decryption failed:', error);
      setDecryptError(`Unable to decrypt text: ${error.message}. Make sure you have the correct encrypted text and are using the same passkey.`);
      setPlainText('');
      editorRef.current?.clear();
      addDebugLog(`Decryption failed: ${error.message}`);
      isDecrypting.current = false;
    }
  }, [encryptionKey]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Shield className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
          <h1 className="text-4xl font-bold mb-2">Passkey Demo</h1>
          <p className="text-gray-400">Experience the future of authentication</p>
        </div>

        {status === 'initial' && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Register */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Register New Passkey</h2>
              <form onSubmit={handleRegister} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-5 h-5" />
                  Register with Passkey
                </button>
              </form>
            </div>

            {/* Login */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Login with Passkey</h2>
              <p className="text-gray-400 mb-6">
                Already have a passkey? Login directly without registration.
              </p>
              <button
                onClick={handleAuthenticate}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <KeyRound className="w-5 h-5" />
                Login with Passkey
              </button>
            </div>
          </div>
        )}

        {status === 'registered' && (
          <div className="max-w-md mx-auto">
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
              <h2 className="text-xl font-semibold mb-2">Registration Successful!</h2>
              <p className="text-gray-400 mb-4">Your passkey has been created.</p>
              <button
                onClick={handleAuthenticate}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <KeyRound className="w-5 h-5" />
                Continue to Login
              </button>
            </div>
          </div>
        )}

        {status === 'authenticated' && (
          <div className="w-full mx-auto space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Secure Note</h2>
              <div className="grid grid-cols-2 gap-6">
                {/* Left side - Plain text editor */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Plain Text</h3>
                  <div className="min-h-[400px]">
                    <LexicalEditor
                      ref={editorRef}
                      initialContent={plainText}
                      onChange={handlePlainTextChange}
                      placeholder="Enter text to encrypt or see decrypted content"
                      className="min-h-[400px] bg-gray-700 border border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-emerald-500 text-gray-100"
                    />
                  </div>
                </div>

                {/* Right side - Encrypted text editor */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Encrypted Text</h3>
                  <textarea
                    value={encryptedText}
                    onChange={handleEncryptedTextChange}
                    placeholder="Paste encrypted text here to decrypt"
                    className={`w-full min-h-[400px] p-4 bg-gray-700 border rounded-lg text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      decryptError ? 'border-red-500' : 'border-gray-600'
                    }`}
                  />
                  {decryptError && (
                    <div className="mt-2 text-red-400 text-sm flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{decryptError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Debug Log */}
              <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Debug Log</h3>
                <div className="text-xs font-mono text-gray-300 space-y-1 max-h-40 overflow-y-auto">
                  {debug.map((log, i) => (
                    <div key={i} className="border-l-2 border-gray-700 pl-2">{log}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  );
} 