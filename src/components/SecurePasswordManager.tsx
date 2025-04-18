import React, { useState, useEffect } from 'react';
import { KeyRound, Shield, Eye, EyeOff, Plus, Trash2, ExternalLink, Copy, Check, Settings, ShieldCheck, CreditCard, FileText, User, Search, Settings2 } from 'lucide-react';
import { DatabaseProvider, useDatabase } from '../pglite/db-context';
import { ParseSchema } from '@/pglite';
import { SecureVaultSidebar, VaultItem } from './SecureVaultSidebar';
import { useAuth } from '@/webauthn/AuthContext';

// Define the schema for our password manager
const PASSWORD_MANAGER_SCHEMA = `
  CREATE TABLE IF NOT EXISTS password_entries (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    url TEXT,
    notes TEXT,
    category TEXT NOT NULL DEFAULT 'Passwords',
    subcategory TEXT,
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
  category: string;
  subcategory?: string;
  created_at: Date;
  updated_at: Date;
}

// Props for the component
export interface SecurePasswordManagerProps {
  className?: string;
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
        <label htmlFor="category" className="block text-sm font-medium mb-1">Category</label>
        <select
          id="category"
          name="category"
          value={formData.category || 'Passwords'}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
        >
          <option value="Passwords">Passwords</option>
          <option value="Payment Methods">Payment Methods</option>
          <option value="Secure Notes">Secure Notes</option>
          <option value="Personal Info">Personal Info</option>
          <option value="IDs">IDs</option>
        </select>
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
          Save Entry
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
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<PasswordEntry | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copyState, setCopyState] = useState<{ [key: string]: boolean }>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("All Items");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Load entries when database is ready
  useEffect(() => {
    if (isInitialized && db) {
      loadEntries();
    }
  }, [isInitialized, db]);

  // Load all entries from the database
  const loadEntries = async () => {
    if (!db) return;
    
    try {
      setIsLoading(true);
      const data = await db.password_entries.findMany({
        orderBy: { title: 'asc' }
      });
      setEntries(data);
    } catch (err) {
      console.error('Error loading entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Save a new or updated entry
  const handleSaveEntry = async (entry: Partial<PasswordEntry>) => {
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
          category: entry.category || 'Passwords',
          subcategory: entry.subcategory,
          updated_at: new Date(),
          created_at: new Date()
        });
      }
      
      // Reload entries
      await loadEntries();
      setSelectedEntry(null);
      setIsAddingNew(false);
    } catch (err) {
      console.error('Error saving entry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete an entry
  const handleDeleteEntry = async (id: number) => {
    if (!db) return;
    
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        setIsLoading(true);
        await db.password_entries.delete({ id });
        await loadEntries();
        if (selectedEntry?.id === id) {
          setSelectedEntry(null);
        }
      } catch (err) {
        console.error('Error deleting entry:', err);
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

  // Handle adding new entry
  const handleAddNew = () => {
    setSelectedEntry(null);
    setIsAddingNew(true);
  };

  // Handle category selection
  const handleCategorySelect = (category: string, subcategory?: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory(subcategory);
  };

  // Get item counts for the sidebar
  const getItemCounts = () => {
    const counts: Record<string, number> = {
      total: entries.length,
      passwords: 0,
      payment: 0,
      notes: 0,
      personal: 0,
      identities: 0,
    };

    entries.forEach(entry => {
      switch (entry.category) {
        case "Passwords":
          counts.passwords++;
          break;
        case "Payment Methods":
          counts.payment++;
          break;
        case "Secure Notes":
          counts.notes++;
          break;
        case "Personal Info":
          counts.personal++;
          break;
        case "IDs & Licenses":
          counts.identities++;
          break;
      }
    });

    return counts;
  };

  // Filter entries based on selected category/subcategory and search query
  const filteredEntries = entries.filter(entry => {
    const matchesCategory = selectedCategory === "All Items" || 
      (entry.category === selectedCategory && 
       (!selectedSubcategory || entry.subcategory === selectedSubcategory));
    
    const matchesSearch = searchQuery === "" || 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.notes && entry.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  // Render loading state
  if (isLoading && !entries.length) {
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
    <div className="flex h-screen">
      <SecureVaultSidebar 
        onAddItem={handleAddNew}
        onSelectItem={handleCategorySelect}
        selectedCategory={selectedCategory}
        itemCounts={getItemCounts()}
      />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Header with search and add button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            {selectedCategory}
            {selectedSubcategory && (
              <>
                <span className="mx-2 text-gray-400">/</span>
                <span className="text-gray-200">{selectedSubcategory}</span>
              </>
            )}
          </h1>
          
          <div className="flex gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search vault..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-64 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            </div>
            
            <button
              onClick={handleAddNew}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center gap-2"
              disabled={isAddingNew}
            >
              <Plus size={18} />
              Add Item
            </button>
          </div>
        </div>

        {/* Password editor */}
        {(isAddingNew || selectedEntry) && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg mb-6">
            <h3 className="text-lg font-medium mb-4">
              {selectedEntry ? 'Edit Entry' : 'Add New Entry'}
            </h3>
            <PasswordForm 
              entry={selectedEntry || { 
                category: selectedCategory === "All Items" ? "Passwords" : selectedCategory,
                subcategory: selectedSubcategory
              }}
              onSave={handleSaveEntry}
              onCancel={() => {
                setIsAddingNew(false);
                setSelectedEntry(null);
              }}
            />
          </div>
        )}

        {/* Entries list */}
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 bg-gray-800 rounded-lg">
            <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-emerald-400 opacity-50" />
            <h3 className="text-xl font-medium text-gray-300">No Items Found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery ? "Try a different search term" : "Add your first entry to get started"}
            </p>
            <button
              onClick={handleAddNew}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Add Item
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEntries.map(entry => (
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
                      title="Edit entry"
                    >
                      <Settings2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-gray-400 hover:text-red-400"
                      title="Delete entry"
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
    </div>
  );
};

// Main component
export function SecurePasswordManager({ className }: SecurePasswordManagerProps) {
  const { encryptionKey } = useAuth();
  
  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white ${className || ''}`}>
      <div className="h-screen">
        <DatabaseProvider 
          schema={PASSWORD_MANAGER_SCHEMA} 
          dbName="secure-password-manager"
          encryptionKey={encryptionKey}
          debug={false}
        >
          <PasswordManagerContent />
        </DatabaseProvider>
      </div>
    </div>
  );
} 