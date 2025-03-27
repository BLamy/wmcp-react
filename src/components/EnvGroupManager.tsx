import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Shield, Eye, EyeOff, Plus, Trash2, ExternalLink, Copy, Check, Settings, ShieldCheck, Edit } from 'lucide-react';
import { DatabaseProvider, useDatabase } from '../pglite/db-context';
import { ParseSchema } from '@/pglite';
import { useAuth } from '@/lib/AuthContext';

// Define the schema for our env group manager
const ENV_GROUP_MANAGER_SCHEMA = `
  CREATE TABLE IF NOT EXISTS env_groups (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS env_variables (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    group_id BIGINT NOT NULL REFERENCES env_groups(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Interface for env groups and variables
interface EnvGroup {
  id: number;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

interface EnvVariable {
  id: number;
  group_id: number;
  key: string;
  value: string;
  created_at: Date;
  updated_at: Date;
}

// Props for the component
export interface EnvGroupManagerProps {
  className?: string;
}

// Environment variable form component
const EnvVariableForm = ({
  variable,
  groupId,
  onSave,
  onCancel
}: {
  variable: Partial<EnvVariable>;
  groupId: number;
  onSave: (variable: Partial<EnvVariable>) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState<Partial<EnvVariable>>({
    ...variable,
    group_id: groupId
  });
  const [showValue, setShowValue] = useState(false);

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
        <label htmlFor="key" className="block text-sm font-medium mb-1">Key</label>
        <input
          type="text"
          id="key"
          name="key"
          value={formData.key || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
          required
        />
      </div>
      
      <div>
        <label htmlFor="value" className="block text-sm font-medium mb-1">Value</label>
        <div className="relative">
          <input
            type={showValue ? "text" : "password"}
            id="value"
            name="value"
            value={formData.value || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white pr-10"
            required
          />
          <button 
            type="button"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            onClick={() => setShowValue(!showValue)}
          >
            {showValue ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          Save Variable
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

// Environment group form component
const EnvGroupForm = ({
  group,
  onSave,
  onCancel
}: {
  group: Partial<EnvGroup>;
  onSave: (group: Partial<EnvGroup>) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState<Partial<EnvGroup>>(group);

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
        <label htmlFor="name" className="block text-sm font-medium mb-1">Group Name</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
          required
          placeholder="A unique name for your environment group"
        />
      </div>
      
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">Description (optional)</label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
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
          Save Group
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

// Environment Group Detail Component
const EnvGroupDetail = ({
  group,
  onBack
}: {
  group: EnvGroup;
  onBack: () => void;
}) => {
  const { db, isInitialized } = useDatabase<ParseSchema<typeof ENV_GROUP_MANAGER_SCHEMA>>();
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<EnvVariable | null>(null);
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copyState, setCopyState] = useState<{ [key: string]: boolean }>({});

  // Load variables when database is ready
  useEffect(() => {
    if (isInitialized && db) {
      loadVariables();
    }
  }, [isInitialized, db, group.id]);

  // Load all variables for this group
  const loadVariables = async () => {
    if (!db) return;
    
    try {
      setIsLoading(true);
      const vars = await db.env_variables.findMany({
        where: { group_id: group.id },
        orderBy: { key: 'asc' }
      });
      setVariables(vars);
    } catch (err) {
      console.error('Error loading variables:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Save a new or updated variable
  const handleSaveVariable = async (variable: Partial<EnvVariable>) => {
    if (!db) return;
    
    try {
      setIsLoading(true);
      
      if (selectedVariable) {
        // Update existing variable
        await db.env_variables.update({
          where: { id: selectedVariable.id },
          data: {
            ...variable,
            updated_at: new Date()
          }
        });
      } else {
        // Create new variable
        await db.env_variables.create({
          key: variable.key!,
          value: variable.value!,
          group_id: group.id,
          updated_at: new Date(),
          created_at: new Date()
        });
      }
      
      // Reload variables
      await loadVariables();
      setSelectedVariable(null);
      setIsAddingVariable(false);
    } catch (err) {
      console.error('Error saving variable:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a variable
  const handleDeleteVariable = async (id: number) => {
    if (!db) return;
    
    if (window.confirm('Are you sure you want to delete this variable?')) {
      try {
        setIsLoading(true);
        await db.env_variables.delete({ id });
        await loadVariables();
        if (selectedVariable?.id === id) {
          setSelectedVariable(null);
        }
      } catch (err) {
        console.error('Error deleting variable:', err);
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

  // Handle adding new variable
  const handleAddVariable = () => {
    setSelectedVariable(null);
    setIsAddingVariable(true);
  };

  // Render loading state
  if (isLoading && !variables.length) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Header with group name and back button */}
      <div className="flex justify-between items-center">
        <div>
          <button 
            onClick={onBack}
            className="text-gray-400 hover:text-white mb-2"
          >
            ← Back to Environment Groups
          </button>
          <h2 className="text-xl font-semibold">{group.name}</h2>
          {group.description && <p className="text-gray-400 text-sm">{group.description}</p>}
        </div>
        <button
          onClick={handleAddVariable}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center gap-2"
          disabled={isAddingVariable}
        >
          <Plus size={18} />
          Add Variable
        </button>
      </div>

      {/* Environment Variables section */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Environment Variables</h3>
          <p className="text-sm text-gray-400">Set environment-specific config and secrets</p>
        </div>

        {/* Variable editor */}
        {(isAddingVariable || selectedVariable) && (
          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 shadow-lg mb-4">
            <h3 className="text-lg font-medium mb-4">
              {selectedVariable ? 'Edit Variable' : 'Add New Variable'}
            </h3>
            <EnvVariableForm 
              variable={selectedVariable || {}}
              groupId={group.id}
              onSave={handleSaveVariable}
              onCancel={() => {
                setIsAddingVariable(false);
                setSelectedVariable(null);
              }}
            />
          </div>
        )}

        {/* Variables list */}
        {variables.length === 0 ? (
          <div className="text-center py-8 bg-gray-700 rounded-lg">
            <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-emerald-400 opacity-50" />
            <h3 className="text-xl font-medium text-gray-300">No Variables Yet</h3>
            <p className="text-gray-400 mb-4">Add your first environment variable</p>
            <button
              onClick={handleAddVariable}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Add Variable
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-400">Key</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-400">Value</th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {variables.map(variable => (
                  <tr key={variable.id} className="hover:bg-gray-700/50">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="font-mono font-medium text-sm">{variable.key}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">•••••••••••</span>
                        <button
                          onClick={() => copyToClipboard(variable.value, `value-${variable.id}`)}
                          className="text-gray-400 hover:text-emerald-400"
                          title="Copy value"
                        >
                          {copyState[`value-${variable.id}`] ? (
                            <Check size={16} className="text-emerald-400" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setSelectedVariable(variable)}
                          className="text-gray-400 hover:text-white"
                          title="Edit variable"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteVariable(variable.id)}
                          className="text-gray-400 hover:text-red-400"
                          title="Delete variable"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Main environment groups content component
const EnvGroupManagerContent = () => {
  const { db, isInitialized, error } = useDatabase<ParseSchema<typeof ENV_GROUP_MANAGER_SCHEMA>>();
  const [groups, setGroups] = useState<EnvGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<EnvGroup | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load groups when database is ready
  useEffect(() => {
    if (isInitialized && db) {
      loadGroups();
    }
  }, [isInitialized, db]);

  // Load all groups from the database
  const loadGroups = async () => {
    if (!db) return;
    
    try {
      setIsLoading(true);
      const envGroups = await db.env_groups.findMany({
        orderBy: { name: 'asc' }
      });
      setGroups(envGroups);
    } catch (err) {
      console.error('Error loading groups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Save a new or updated group
  const handleSaveGroup = async (group: Partial<EnvGroup>) => {
    if (!db) return;
    
    try {
      setIsLoading(true);
      
      if (isEditingGroup && selectedGroup) {
        // Update existing group
        await db.env_groups.update({
          where: { id: selectedGroup.id },
          data: {
            ...group,
            updated_at: new Date()
          }
        });
      } else {
        // Create new group
        await db.env_groups.create({
          name: group.name!,
          description: group.description || '',
          updated_at: new Date(),
          created_at: new Date()
        });
      }
      
      // Reload groups
      await loadGroups();
      setIsEditingGroup(false);
      setIsAddingGroup(false);
    } catch (err) {
      console.error('Error saving group:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a group
  const handleDeleteGroup = async (id: number) => {
    if (!db) return;
    
    if (window.confirm('Are you sure you want to delete this environment group? All variables will be deleted.')) {
      try {
        setIsLoading(true);
        await db.env_groups.delete({ id });
        await loadGroups();
        if (selectedGroup?.id === id) {
          setSelectedGroup(null);
        }
      } catch (err) {
        console.error('Error deleting group:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle adding new group
  const handleAddGroup = () => {
    setSelectedGroup(null);
    setIsEditingGroup(false);
    setIsAddingGroup(true);
  };

  // Handle editing group
  const handleEditGroup = (group: EnvGroup) => {
    setSelectedGroup(group);
    setIsAddingGroup(false);
    setIsEditingGroup(true);
  };

  // Handle selecting a group to view details
  const handleSelectGroup = (group: EnvGroup) => {
    setSelectedGroup(group);
    setIsAddingGroup(false);
    setIsEditingGroup(false);
  };

  // Render loading state
  if (isLoading && !groups.length) {
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

  // If viewing a specific group
  if (selectedGroup && !isEditingGroup) {
    return (
      <EnvGroupDetail 
        group={selectedGroup} 
        onBack={() => setSelectedGroup(null)} 
      />
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Header with add button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Environment Groups</h2>
        <button
          onClick={handleAddGroup}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-3 rounded-lg transition-colors flex items-center gap-2"
          disabled={isAddingGroup}
        >
          <Plus size={18} />
          New Environment Group
        </button>
      </div>

      {/* Group editor */}
      {(isAddingGroup || isEditingGroup) && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-lg">
          <h3 className="text-lg font-medium mb-4">
            {isEditingGroup ? 'Edit Environment Group' : 'Add New Environment Group'}
          </h3>
          <EnvGroupForm 
            group={selectedGroup || {}}
            onSave={handleSaveGroup}
            onCancel={() => {
              setIsAddingGroup(false);
              setIsEditingGroup(false);
            }}
          />
        </div>
      )}

      {/* Groups list */}
      {groups.length === 0 ? (
        <div className="text-center py-8 bg-gray-800 rounded-lg">
          <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-emerald-400 opacity-50" />
          <h3 className="text-xl font-medium text-gray-300">No Environment Groups Yet</h3>
          <p className="text-gray-400 mb-4">Add your first environment group to get started</p>
          <button
            onClick={handleAddGroup}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <Plus size={18} />
            New Environment Group
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead>
              <tr>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-400">ENV GROUP NAME</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-400">ENVIRONMENT</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-400">ENV VARS</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-400">SECRET FILES</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-400">UPDATED</th>
                <th className="py-3 px-4 text-right text-sm font-medium text-gray-400">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {groups.map(group => (
                <tr 
                  key={group.id} 
                  className="hover:bg-gray-700/50 cursor-pointer"
                  onClick={() => handleSelectGroup(group)}
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-medium">{group.name}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-gray-400">—</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-mono">0</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-mono">0</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-gray-400">{new Date(group.updated_at).toLocaleDateString()}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-right">
                    <div className="flex justify-end space-x-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditGroup(group);
                        }}
                        className="text-gray-400 hover:text-white"
                        title="Edit group"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                        className="text-gray-400 hover:text-red-400"
                        title="Delete group"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Main component
export function EnvGroupManager({ className }: EnvGroupManagerProps) {
  const { encryptionKey } = useAuth();
  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white ${className || ''}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
          <h1 className="text-3xl font-bold mb-2">Environment Variables Manager</h1>
          <p className="text-gray-400">Manage your environment variables safely</p>
        </div>

        <div className="w-full mx-auto">
          <div className="bg-gray-800 rounded-lg p-6 mb-4">
            <DatabaseProvider 
              schema={ENV_GROUP_MANAGER_SCHEMA} 
              dbName="env-group-manager"
              encryptionKey={encryptionKey} // Enable encryption for TEXT fields
              debug={false}
            >
              <EnvGroupManagerContent />
            </DatabaseProvider>
          </div>
        </div>
      </div>
    </div>
  );
} 