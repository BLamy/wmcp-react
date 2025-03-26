import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Shield, Eye, EyeOff, Plus, Trash2, ExternalLink, Copy, Check, Settings, ShieldCheck } from 'lucide-react';
import { startRegistration, startAuthentication, WebAuthnError } from '../lib/webauthn';
import { DatabaseProvider, useDatabase } from '../pglite/db-context';
import { ParseSchema } from '@/pglite';

// Define the schema for our password manager
const PASSWORD_MANAGER_SCHEMA = `
  CREATE TABLE IF NOT EXISTS password_entries (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    url TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Interface for password entries
interface PasswordEntry {
  id: number;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

// Props for the component
export interface SecurePasswordManagerProps {
  initialEmail?: string;
}

// Password content form component
const PasswordForm = ({
  entry,
  onSave,
  onCancel
}: {
  entry: Partial<PasswordEntry>;
  onSave: (entry: Partial<PasswordEntry>) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState<Partial<PasswordEntry>>(entry);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
          required
        />
      </div>
      
      <div>
        <label htmlFor="username" className="block text-sm font-medium mb-1">Username/Email</label>
        <input
          type="text"
          id="username"
          name="username"
          value={formData.username || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            value={formData.password || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white pr-10"
            required
          />
          <button 
            type="button"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="url" className="block text-sm font-medium mb-1">URL (optional)</label>
        <input
          type="url"
          id="url"
          name="url"
          value={formData.url || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1">Notes (optional)</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white resize-none"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          Save Password
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// Main database content component
const PasswordManagerContent = () => {
  const { db, isInitialized, error } = useDatabase<ParseSchema<typeof PASSWORD_MANAGER_SCHEMA>>();
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<PasswordEntry | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copyState, setCopyState] = useState<{ [key: string]: boolean }>({});

  // Load passwords when database is ready
  useEffect(() => {
    if (isInitialized && db) {
      loadPasswords();
    }
  }, [isInitialized, db]);

  // Load all passwords from the database
  const loadPasswords = async () => {
    if (!db) return;
    
    try {
      setIsLoading(true);
      const entries = await db.password_entries.findMany({
        orderBy: { title: 'asc' }
      });
      setPasswords(entries);
    } catch (err) {
      console.error('Error loading passwords:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Save a new or updated password
  const handleSavePassword = async (entry: Partial<PasswordEntry>) => {
    if (!db) return;
    
    try {
      setIsLoading(true);
      
      if (selectedEntry) {
        // Update existing entry
        await db.password_entries.update({
          where: { id: selectedEntry.id },
          data: {
            ...entry,
            updated_at: new Date()
          }
        });
      } else {
        // Create new entry
        await db.password_entries.create({
          title: entry.title!,
          username: entry.username!,
          password: entry.password!,
          url: entry.url || '',
          notes: entry.notes || '',
          updated_at: new Date(),
          created_at: new Date()
        });
      }
      
      // Reload passwords
      await loadPasswords();
      setSelectedEntry(null);
      setIsAddingNew(false);
    } catch (err) {
      console.error('Error saving password:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a password entry
  const handleDeletePassword = async (id: number) => {
    if (!db) return;
    
    if (window.confirm('Are you sure you want to delete this password?')) {
      try {
        setIsLoading(true);
        await db.password_entries.delete({ id });
        await loadPasswords();
        if (selectedEntry?.id === id) {
          setSelectedEntry(null);
        }
      } catch (err) {
        console.error('Error deleting password:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Copy text to clipboard
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState({ [field]: true });
      setTimeout(() => setCopyState({}), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle adding new password
  const handleAddNew = () => {
    setSelectedEntry(null);
    setIsAddingNew(true);
  };

  // Render loading state
  if (isLoading && !passwords.length) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-lg">
        <h3 className="font-medium">Database Error</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Header with add button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Passwords</h2>
        <button
          onClick={handleAddNew}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center gap-2"
          disabled={isAddingNew}
        >
          <Plus size={18} />
          Add Password
        </button>
      </div>

      {/* Password editor */}
      {(isAddingNew || selectedEntry) && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-lg">
          <h3 className="text-lg font-medium mb-4">
            {selectedEntry ? 'Edit Password' : 'Add New Password'}
          </h3>
          <PasswordForm 
            entry={selectedEntry || {}}
            onSave={handleSavePassword}
            onCancel={() => {
              setIsAddingNew(false);
              setSelectedEntry(null);
            }}
          />
        </div>
      )}

      {/* Password list */}
      {passwords.length === 0 ? (
        <div className="text-center py-8 bg-gray-800 rounded-lg">
          <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-emerald-400 opacity-50" />
          <h3 className="text-xl font-medium text-gray-300">No Passwords Yet</h3>
          <p className="text-gray-400 mb-4">Add your first password to get started</p>
          <button
            onClick={handleAddNew}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Add Password
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {passwords.map(entry => (
            <div 
              key={entry.id} 
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-emerald-500/50 transition-all"
            >
              <div className="flex justify-between items-start">
                <h3 className="font-medium truncate">{entry.title}</h3>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setSelectedEntry(entry)}
                    className="text-gray-400 hover:text-white"
                    title="Edit password"
                  >
                    <Settings size={18} />
                  </button>
                  <button
                    onClick={() => handleDeletePassword(entry.id)}
                    className="text-gray-400 hover:text-red-400"
                    title="Delete password"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <div className="mt-2 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Username</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium truncate max-w-[120px]">
                      {entry.username}
                    </span>
                    <button
                      onClick={() => copyToClipboard(entry.username, `username-${entry.id}`)}
                      className="text-gray-400 hover:text-emerald-400"
                      title="Copy username"
                    >
                      {copyState[`username-${entry.id}`] ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Password</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">•••••••••••</span>
                    <button
                      onClick={() => copyToClipboard(entry.password, `password-${entry.id}`)}
                      className="text-gray-400 hover:text-emerald-400"
                      title="Copy password"
                    >
                      {copyState[`password-${entry.id}`] ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
                
                {entry.url && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">URL</span>
                    <a
                      href={entry.url.startsWith('http') ? entry.url : `https://${entry.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline flex items-center gap-1 text-sm truncate max-w-[150px]"
                    >
                      {new URL(entry.url.startsWith('http') ? entry.url : `https://${entry.url}`).hostname}
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Main component
export function SecurePasswordManager({ initialEmail = '' }: SecurePasswordManagerProps) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<'initial' | 'registered' | 'authenticated'>('initial');
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof WebAuthnError ? err.message : 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Shield className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
          <h1 className="text-4xl font-bold mb-2">Secure Password Manager</h1>
          <p className="text-gray-400">Your passwords, encrypted and secure</p>
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
          <div className="w-full mx-auto">
            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <DatabaseProvider 
                schema={PASSWORD_MANAGER_SCHEMA} 
                dbName="secure-password-manager"
                secure={true} // Enable encryption for TEXT fields
                debug={false}
              >
                <PasswordManagerContent />
              </DatabaseProvider>
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