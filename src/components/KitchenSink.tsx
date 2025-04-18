// src/components/KitchenSink.tsx
import React, { useState, useEffect } from 'react';
import WebContainerProvider from '../wmcp/providers/Webcontainer';
import { DatabaseProvider } from '../pglite/db-context';
import { useMCPServer, MCPServerStatus } from '../wmcp/hooks/useMcpServer';
import { ServerConfig } from '../wmcp/lib/McpClientManager';
import { ServerConfigSheet } from '../wmcp/components/chat'; // Reusing from Chat component
import { Tool, ToolsList } from '../wmcp/components/mcp/ToolsList';
import { ResourcesList } from '../wmcp/components/mcp/ResourcesList';
import { ActionCard } from '../wmcp/components/layout/ActionCard';
import { Chat } from '../wmcp/components/chat';
import { EnvGroupManager } from './EnvGroupManager';
import { DatabaseBrowser } from '../pglite/database-browser';
import { SecurePasswordManager } from './SecurePasswordManager';
import { Server, List, Database, Settings, Key, MessageSquare, Variable, BrainCircuit } from 'lucide-react';
import { useDatabase, DBOperations, ParseSchema } from '../pglite'; // Adjust path as needed
import { Button } from '@/components/aria/Button';
import { Edit, Save, Plus, Trash2, AlertCircle } from 'lucide-react';
import { StatusIndicator } from '@/wmcp/components/status/StatusIndicator';
import { AuthProvider, useAuth } from '../webauthn/AuthContext';
import { LoginPage } from './LoginPage';
// import type { Tool } from '../wmcp/types'; // Add this import for Tool type


// Assume the schema is imported or defined here
const ENV_GROUP_MANAGER_SCHEMA = `
  CREATE TABLE IF NOT EXISTS env_groups (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, name TEXT NOT NULL UNIQUE, description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS env_variables (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, group_id BIGINT NOT NULL REFERENCES env_groups(id) ON DELETE CASCADE,
    key TEXT NOT NULL, value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (group_id, key)
  );
`;

type EnvGroupManagerSchema = ParseSchema<typeof ENV_GROUP_MANAGER_SCHEMA>;
type EnvGroup = EnvGroupManagerSchema['env_groups'];
type EnvVariable = EnvGroupManagerSchema['env_variables'];

interface ModelDefinition {
    id: string;
    name: string;
    description: string;
    requiredKeys: string[]; // e.g., ['OPENAI_API_KEY', 'OPENAI_ORG_ID']
    envGroupId: number | null; // ID of the associated env_group
}

export function ModelConfigurator() {
    const { db, isInitialized, error } = useDatabase<EnvGroupManagerSchema>();
    const [models, setModels] = useState<ModelDefinition[]>([
        // Hardcoded models for demo
        { id: 'claude-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic\'s latest Sonnet model', requiredKeys: ['ANTHROPIC_API_KEY'], envGroupId: null },
        { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI\'s flagship model', requiredKeys: ['OPENAI_API_KEY'], envGroupId: null },
        { id: 'llama3-70b', name: 'Llama 3 70B', description: 'Meta\'s large language model (requires self-hosting config)', requiredKeys: ['LLAMA_API_ENDPOINT', 'LLAMA_API_KEY'], envGroupId: null },
    ]);
    const [envGroups, setEnvGroups] = useState<EnvGroup[]>([]);
    const [envVariables, setEnvVariables] = useState<Record<number, EnvVariable[]>>({}); // group_id -> variables
    const [editingVariable, setEditingVariable] = useState<{ groupId: number, key: string, value: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isInitialized && db) {
            loadEnvGroupsAndVariables();
        }
    }, [isInitialized, db]);

    const loadEnvGroupsAndVariables = async () => {
        if (!db) return;
        setIsLoading(true);
        try {
            const groups = await db.env_groups.findMany();
            setEnvGroups(groups);

            const varsByGroup: Record<number, EnvVariable[]> = {};
            for (const group of groups) {
                const vars = await db.env_variables.findMany({ where: { group_id: group.id } });
                varsByGroup[group.id] = vars;
            }
            setEnvVariables(varsByGroup);

            // TODO: Load saved model configurations if they were persisted
            // For now, we just load the groups and variables

        } catch (err) {
            console.error("Error loading env data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleModelEnvGroupChange = (modelId: string, groupId: number | null) => {
        setModels(prevModels =>
            prevModels.map(model =>
                model.id === modelId ? { ...model, envGroupId: groupId } : model
            )
        );
        // TODO: Persist this change if needed
    };

    const getVariableValue = (groupId: number | null, key: string): string | undefined => {
        if (groupId === null || !envVariables[groupId]) return undefined;
        return envVariables[groupId].find(v => v.key === key)?.value;
    };

    const handleSaveVariable = async () => {
        if (!editingVariable || !db) return;

        const { groupId, key, value } = editingVariable;
        const existingVar = envVariables[groupId]?.find(v => v.key === key);

        try {
            if (existingVar) {
                // Update existing variable
                await db.env_variables.update({
                    where: { id: existingVar.id },
                    data: { value, updated_at: new Date() }
                });
            } else {
                // Create new variable
                await db.env_variables.create({
                    group_id: groupId,
                    key,
                    value,
                    created_at: new Date(),
                    updated_at: new Date(),
                });
            }
            setEditingVariable(null);
            await loadEnvGroupsAndVariables(); // Reload data
        } catch (err) {
            console.error("Error saving variable:", err);
        }
    };

    if (error) return <div className="p-4 text-red-500">Database Error: {error.message}</div>;
    if (!isInitialized || isLoading) return <div className="p-4">Loading...</div>;

    return (
        <div className="space-y-6">
            {models.map(model => (
                <div key={model.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-medium mb-1">{model.name}</h3>
                    <p className="text-sm text-gray-400 mb-4">{model.description}</p>

                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Environment Group</label>
                        <select
                            value={model.envGroupId ?? ''}
                            onChange={(e) => handleModelEnvGroupChange(model.id, e.target.value ? Number(e.target.value) : null)}
                            className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                        >
                            <option value="">None</option>
                            {envGroups.map(group => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                            ))}
                        </select>
                    </div>

                    {model.envGroupId !== null && (
                        <div>
                            <h4 className="text-md font-medium mb-2">Required Keys</h4>
                            {model.requiredKeys.length === 0 ? (
                                <p className="text-sm text-gray-500">No specific keys required for this model.</p>
                            ) : (
                                <div className="space-y-3">
                                    {model.requiredKeys.map(key => {
                                        const value = getVariableValue(model.envGroupId, key);
                                        const isEditingThis = editingVariable?.groupId === model.envGroupId && editingVariable?.key === key;

                                        return (
                                            <div key={key} className="flex items-center gap-2 p-2 bg-gray-700 rounded">
                                                <span className="font-mono text-sm w-1/3 truncate">{key}</span>
                                                {isEditingThis ? (
                                                    <input
                                                        type="password"
                                                        value={editingVariable.value}
                                                        onChange={(e) => setEditingVariable({ ...editingVariable, value: e.target.value })}
                                                        className="flex-1 px-2 py-1 text-sm rounded bg-gray-600 border border-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                    />
                                                ) : (
                                                    <span className={`flex-1 text-sm font-mono truncate ${value ? 'text-green-400' : 'text-red-400 italic'}`}>
                                                        {value ? '•••••••••• (Set)' : 'Not Set'}
                                                    </span>
                                                )}
                                                {isEditingThis ? (
                                                    <>
                                                        <Button 
                                                            variant="primary" 
                                                            className="text-sm py-1 px-2" 
                                                            onPress={handleSaveVariable}>
                                                            <Save size={14} />
                                                        </Button>
                                                        <Button 
                                                            variant="secondary" 
                                                            className="text-sm py-1 px-2" 
                                                            onPress={() => setEditingVariable(null)}>
                                                            Cancel
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button
                                                        variant="secondary"
                                                        className="text-sm py-1 px-2"
                                                        onPress={() => setEditingVariable({ groupId: model.envGroupId!, key, value: value || '' })}
                                                    >
                                                        <Edit size={14} /> {value ? 'Edit' : 'Set'}
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {model.envGroupId === null && (
                                        <div className="flex items-center gap-2 text-yellow-400 text-sm mt-2">
                                            <AlertCircle size={16} />
                                            Select an Environment Group to manage keys.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
// --- Schemas ---

const CHAT_SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY, role TEXT NOT NULL, content TEXT NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, session_id TEXT, metadata JSONB
  );
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tool_calls (
    id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    function_name TEXT NOT NULL, arguments JSONB
  );
`;

const PASSWORD_MANAGER_SCHEMA = `
  CREATE TABLE IF NOT EXISTS password_entries (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, title TEXT NOT NULL, username TEXT NOT NULL,
    password TEXT NOT NULL, url TEXT, notes TEXT, category TEXT NOT NULL DEFAULT 'Passwords',
    subcategory TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const DB_EXPLORER_SCHEMA = `
  -- Combine schemas for browsing
  ${CHAT_SCHEMA}
  ${ENV_GROUP_MANAGER_SCHEMA}
  ${PASSWORD_MANAGER_SCHEMA}

  -- Add some extra tables for demo
  CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, name TEXT NOT NULL, price NUMERIC(10, 2), category TEXT
  );
  INSERT INTO products (name, price, category) VALUES ('Laptop', 1200.50, 'Electronics'), ('Desk Chair', 150.00, 'Furniture') ON CONFLICT DO NOTHING;
`;

// --- Page Components ---

const ChatPage = () => (
    <DatabaseProvider schema={CHAT_SCHEMA} dbName="kitchensink-chat-db" debug={false}>
        <Chat
            enablePersistence={true}
            // Use default server configs or allow configuration via ModelConfig page
            serverConfigs={{
                memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], env: {} },
                filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/'], env: {} }
            }}
        />
    </DatabaseProvider>
);

const MCPManagePage = () => {
    const [serverConfigs, setServerConfigs] = useState<Record<string, ServerConfig>>({
        'memory': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], env: {} },
        'filesystem': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/'], env: {} },
        'everything': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-everything'], env: {} }
    });
    const { status, tools, resources, error, toolToServerMap } = useMCPServer({ mcpServers: serverConfigs });
    const [showConfigSheet, setShowConfigSheet] = useState(false);

    const handleSaveConfig = (newConfigs: Record<string, ServerConfig>) => {
        setServerConfigs(newConfigs);
    };

    // Prepare tool mapping for the config sheet
    const serverToolMapping = toolToServerMap ?
        Object.fromEntries(Array.from(toolToServerMap.entries())) : {};

    return (
        <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                    <Server size={20} /> MCP Server Management
                </h2>
                <div className="flex items-center gap-4">
                    <StatusIndicator status={status} />
                    <Button onPress={() => setShowConfigSheet(true)}>
                        <Settings size={16} className="mr-2" /> Configure Servers
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-300 text-red-700 p-3 rounded-md">
                    <p className="font-medium">Error:</p>
                    <p>{error.message}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ActionCard title="Available Tools" icon={<List size={18} />}>
                    <ToolsList tools={tools as Tool[]} isLoading={status !== 'READY'} maxHeight="400px" />
                </ActionCard>
                <ActionCard title="Available Resources" icon={<Database size={18} />}>
                    <ResourcesList resources={resources} isLoading={status !== 'READY'} maxHeight="400px" />
                </ActionCard>
            </div>

            <ServerConfigSheet
                // Provide all potential server configs, not just active ones
                availableServers={{
                    'memory': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], env: {} },
                    'filesystem': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/'], env: {} },
                    'sequential-thinking': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'], env: {} },
                    'everything': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-everything'], env: {} }
                }}
                activeServers={serverConfigs}
                isOpen={showConfigSheet}
                onOpenChange={setShowConfigSheet}
                onSave={handleSaveConfig}
                serverStatus={status}
                tools={tools} // Pass tools with serverName if available
                serverToolMapping={serverToolMapping}
            />
        </div>
    );
};

const EnvManagePage = () => {
    const { encryptionKey } = useAuth();

    return (
        <DatabaseProvider schema={ENV_GROUP_MANAGER_SCHEMA} dbName="kitchensink-env-manager-db" encryptionKey={encryptionKey} debug={false}>
            <EnvGroupManager />
        </DatabaseProvider>
    )
};

const DbExplorerPage = () => (
    <DatabaseProvider schema={DB_EXPLORER_SCHEMA} dbName="kitchensink-db-explorer" debug={false}>
        <DatabaseBrowser />
    </DatabaseProvider>
);

const ModelConfigPage = () => {
    const { encryptionKey } = useAuth();

    return (
        <DatabaseProvider schema={ENV_GROUP_MANAGER_SCHEMA} dbName="kitchensink-env-manager-db" encryptionKey={encryptionKey} debug={false}>
            <div className="p-4">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <BrainCircuit size={20} /> Model Configuration
                </h2>
                <ModelConfigurator />
            </div>
        </DatabaseProvider>
    );
};

const AuthPage = () => {
    const { encryptionKey } = useAuth();

    return (
        <DatabaseProvider schema={PASSWORD_MANAGER_SCHEMA} dbName="kitchensink-auth-db" encryptionKey={encryptionKey} debug={false}>
            {/* Re-purposing SecurePasswordManager for general auth/storage demo */}
            <SecurePasswordManager />
        </DatabaseProvider>
    );
};

// --- KitchenSink Component ---

export type KitchenSinkPage =
    | 'chat'
    | 'mcp_manage'
    | 'env_manage'
    | 'db_explorer'
    | 'model_config'
    | 'auth';

interface KitchenSinkProps {
    initialPage?: KitchenSinkPage;
}

export function KitchenSink({ initialPage = 'chat' }: KitchenSinkProps) {
    const [currentPage, setCurrentPage] = useState<KitchenSinkPage>(initialPage);

    const renderPage = () => {
        switch (currentPage) {
            case 'chat':
                return <ChatPage />;
            case 'mcp_manage':
                return <MCPManagePage />;
            case 'env_manage':
                return <EnvManagePage />;
            case 'db_explorer':
                return <DbExplorerPage />;
            case 'model_config':
                return <ModelConfigPage />;
            case 'auth':
                return <AuthPage />;
            default:
                return <div>Unknown Page</div>;
        }
    };

    const pageConfig: { id: KitchenSinkPage; label: string; icon: React.ElementType }[] = [
        { id: 'chat', label: 'Chat', icon: MessageSquare },
        { id: 'mcp_manage', label: 'MCP Servers', icon: Server },
        { id: 'env_manage', label: 'Env Variables', icon: Variable },
        { id: 'model_config', label: 'Model Config', icon: BrainCircuit },
        { id: 'db_explorer', label: 'DB Explorer', icon: Database },
        { id: 'auth', label: 'Authentication', icon: Key },
    ];

    return (
            <div className="flex h-screen max-h-screen w-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                {/* Sidebar Navigation */}
                <nav className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <h1 className="text-lg font-semibold">Kitchen Sink Demo</h1>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {pageConfig.map(page => (
                            <Button
                                key={page.id}
                                variant={currentPage === page.id ? 'primary' : 'secondary'}
                                className={`w-full justify-start ${currentPage === page.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                onPress={() => setCurrentPage(page.id)}
                            >
                                <page.icon size={16} className="mr-2" />
                                {page.label}
                            </Button>
                        ))}
                    </div>
                </nav>

                {/* Main Content Area */}
                <main className="flex-1 overflow-auto">
                    {renderPage()}
                </main>
            </div>
    );
}

export default KitchenSink;