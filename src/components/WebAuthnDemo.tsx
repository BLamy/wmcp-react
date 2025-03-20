import React, { useState } from 'react';
import { KeyRound, Shield, ShieldCheck } from 'lucide-react';
import { startRegistration, startAuthentication, WebAuthnError } from '../lib/webauthn';
import { deriveKey, encryptData, decryptData } from '../lib/utils';

export interface WebAuthnDemoProps {
  initialEmail?: string;
}

export function WebAuthnDemo({ initialEmail = '' }: WebAuthnDemoProps) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<'initial' | 'registered' | 'authenticated'>('initial');
  const [error, setError] = useState<string | null>(null);
  const [secretNote, setSecretNote] = useState('');
  const [encryptedNote, setEncryptedNote] = useState<string | null>(null);
  const [decryptedNote, setDecryptedNote] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const credential = await startRegistration(email);
      // In a real app, you'd send this to your server
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
      // In a real app, you'd verify this with your server
      console.log('Authentication successful:', assertion);
      setStatus('authenticated');
      
      // Derive an encryption key from the authentication data
      const key = await deriveKey(new TextEncoder().encode(assertion.id));
      
      if (secretNote) {
        const encrypted = await encryptData(key, secretNote);
        setEncryptedNote(encrypted);
        setSecretNote('');
      }
      
      if (encryptedNote) {
        const decrypted = await decryptData(key, encryptedNote);
        setDecryptedNote(decrypted);
      }
    } catch (err) {
      setError(err instanceof WebAuthnError ? err.message : 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="text-center mb-12">
          <Shield className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
          <h1 className="text-4xl font-bold mb-2">Passkey Demo</h1>
          <p className="text-gray-400">Experience the future of authentication</p>
        </div>

        {status === 'initial' && (
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
                className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
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
        )}

        {status === 'registered' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
              <h2 className="text-xl font-semibold mb-2">Registration Successful!</h2>
              <p className="text-gray-400 mb-4">Your passkey has been created.</p>
              <button
                onClick={handleAuthenticate}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <KeyRound className="w-5 h-5" />
                Authenticate
              </button>
            </div>
          </div>
        )}

        {status === 'authenticated' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Secure Note</h2>
              <textarea
                value={secretNote}
                onChange={(e) => setSecretNote(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white mb-4"
                placeholder="Enter a secret note"
                rows={4}
              />
              <button
                onClick={handleAuthenticate}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Encrypt/Decrypt Note
              </button>
              
              {encryptedNote && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Encrypted Note:</h3>
                  <pre className="bg-gray-700 p-4 rounded-lg text-sm overflow-x-auto">
                    {encryptedNote}
                  </pre>
                </div>
              )}
              
              {decryptedNote && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Decrypted Note:</h3>
                  <pre className="bg-gray-700 p-4 rounded-lg text-sm overflow-x-auto">
                    {decryptedNote}
                  </pre>
                </div>
              )}
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