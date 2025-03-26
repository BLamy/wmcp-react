import React, { useState, useEffect } from 'react';
import { DatabaseProvider, useDatabase } from './db-context';
import { Table, TableHeader, Column, Row, Cell } from '../components/aria/Table';
import { TableBody } from 'react-aria-components';

// Define the schema - this will be used to set up any needed tables
const DEFAULT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS database_browser_dummy (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Sample queries that users can try
const SAMPLE_QUERIES = [
  {
    name: "Select all rows",
    query: "SELECT * FROM {table} LIMIT 100"
  },
  {
    name: "Count rows",
    query: "SELECT COUNT(*) as count FROM {table}"
  },
  {
    name: "Show table schema",
    query: `
      SELECT 
        column_name, 
        data_type, 
        column_default,
        is_nullable
      FROM 
        information_schema.columns
      WHERE 
        table_name = '{table}'
      ORDER BY 
        ordinal_position
    `
  },
  {
    name: "Show table constraints",
    query: `
      SELECT 
        c.conname as constraint_name,
        c.contype as constraint_type,
        pg_get_constraintdef(c.oid) as constraint_definition
      FROM 
        pg_constraint c
      JOIN 
        pg_class t ON c.conrelid = t.oid
      WHERE 
        t.relname = '{table}'
    `
  }
];

// Main database browser component
export function DatabaseBrowser({ 
  schema = DEFAULT_SCHEMA,
  dbName = 'database-browser-db',
  secure = false,
  debug = false
}: { 
  schema?: string;
  dbName?: string;
  secure?: boolean;
  debug?: boolean;
}) {
  return (
    <DatabaseProvider schema={schema} dbName={dbName} secure={secure} debug={debug}>
      <div className="database-browser" style={{ padding: '20px' }}>
        <h1 style={{ marginBottom: '20px' }}>Database Browser</h1>
        <DatabaseBrowserContent />
      </div>
    </DatabaseProvider>
  );
}

// Browser content that uses the database context
function DatabaseBrowserContent() {
  const { $raw, isInitialized, error } = useDatabase();
  const [queryText, setQueryText] = useState<string>('');
  const [queryResults, setQueryResults] = useState<any[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load tables when database is initialized
  useEffect(() => {
    if (isInitialized && $raw) {
      loadTables();
    }
  }, [isInitialized, $raw]);

  // Load tables from the database
  const loadTables = async () => {
    if (!$raw) return;
    
    try {
      setIsLoading(true);
      const result = await $raw.query(`
        SELECT tablename FROM pg_catalog.pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);
      
      setTables(result.rows.map((row: any) => row.tablename));
      
      if (result.rows.length > 0) {
        const firstTable = result.rows[0] as { tablename: string };
        setSelectedTable(firstTable.tablename);
        await loadTableData(firstTable.tablename);
      }
    } catch (err) {
      console.error('Error loading tables:', err);
      setQueryError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Load column information for a table
  const loadTableColumns = async (tableName: string) => {
    if (!$raw) return [];
    
    try {
      const result = await $raw.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      return result.rows.map((row: any) => row.column_name);
    } catch (err) {
      console.error(`Error loading columns for ${tableName}:`, err);
      return [];
    }
  };

  // Load data from a table
  const loadTableData = async (tableName: string) => {
    if (!$raw) return;
    
    try {
      setIsLoading(true);
      setSelectedTable(tableName);
      
      // Then fetch data
      const result = await $raw.query(`SELECT * FROM ${tableName} LIMIT 100`);
      
      // Determine all possible columns from all rows
      if (result.rows.length > 0) {
        const allColumns = new Set<string>();
        for (const row of result.rows) {
          // Cast row to Record<string, unknown> to fix TypeScript error
          Object.keys(row as Record<string, unknown>).forEach(key => allColumns.add(key));
        }
        setColumns(Array.from(allColumns));
      } else {
        // If no data, try to get columns from schema
        const cols = await loadTableColumns(tableName);
        setColumns(cols);
      }
      
      setQueryResults(result.rows);
      setQueryError(null);
      
      // Update query text area
      setQueryText(`SELECT * FROM ${tableName} LIMIT 100`);
    } catch (err) {
      console.error('Error loading table data:', err);
      setQueryError(err instanceof Error ? err.message : String(err));
      setQueryResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute a raw SQL query
  const executeQuery = async () => {
    if (!$raw || !queryText.trim()) return;
    
    try {
      setIsLoading(true);
      console.log('Executing query:', queryText);
      const result = await $raw.query(queryText);
      console.log('Query result:', result);
      
      // Special handling for different types of results
      if (result && typeof result === 'object') {
        if (Array.isArray(result.rows) && result.rows.length > 0) {
          // Normal result with rows
          const allColumns = new Set<string>();
          for (const row of result.rows) {
            // Cast row to Record<string, unknown> to fix TypeScript error
            Object.keys(row as Record<string, unknown>).forEach(key => allColumns.add(key));
          }
          setColumns(Array.from(allColumns));
          setQueryResults(result.rows);
        } else if (Array.isArray(result.rows) && result.rows.length === 0) {
          // Empty result set
          setColumns([]);
          setQueryResults([]);
        } else if (result.command && !result.rows) {
          // Non-query commands like INSERT, UPDATE, DELETE
          setColumns(['command', 'rowCount', 'result']);
          setQueryResults([{
            command: result.command,
            rowCount: result.rowCount || 0,
            result: `${result.command} command executed successfully`
          }]);
        } else {
          // Other object results
          setColumns(['result']);
          setQueryResults([{ result: JSON.stringify(result) }]);
        }
      } else {
        // Scalar result
        setColumns(['result']);
        setQueryResults([{ result: String(result) }]);
      }
      
      setQueryError(null);
    } catch (err) {
      console.error('Query error:', err);
      setQueryError(err instanceof Error ? err.message : String(err));
      setQueryResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply a sample query template
  const applySampleQuery = (queryTemplate: string) => {
    if (!selectedTable) return;
    
    // Replace {table} placeholder with the actual selected table
    const query = queryTemplate.replace(/{table}/g, selectedTable);
    
    // Update the query text field
    setQueryText(query);
    
    // Automatically execute the query
    setTimeout(() => {
      executeQuery();
    }, 100);
  };

  if (error) {
    return (
      <div className="error-state" style={{ 
        padding: '20px', 
        color: '#e53e3e', 
        border: '1px solid #f5c2c7', 
        backgroundColor: '#f8d7da', 
        borderRadius: '4px' 
      }}>
        <h2>Database Error</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!isInitialized) {
    return <div>Initializing database...</div>;
  }

  return (
    <div className="database-browser-content">
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        gap: '20px',
        height: 'calc(100vh - 120px)',
      }}>
        {/* Left sidebar - Table list */}
        <div style={{ 
          width: '200px', 
          borderRight: '1px solid #e5e7eb',
          overflowY: 'auto',
          padding: '10px'
        }}>
          <h3 style={{ marginBottom: '10px' }}>Tables</h3>
          <div className="table-list">
            {tables.length === 0 ? (
              <p>No tables found</p>
            ) : (
              tables.map(table => (
                <div 
                  key={table} 
                  onClick={() => loadTableData(table)}
                  style={{ 
                    padding: '8px', 
                    cursor: 'pointer',
                    borderRadius: '4px',
                    backgroundColor: selectedTable === table ? '#e5e7eb' : 'transparent'
                  }}
                >
                  {table}
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
          {/* Query editor */}
          <div style={{ marginBottom: '20px' }}>
            <textarea
              value={queryText}
              onChange={e => setQueryText(e.target.value)}
              style={{ 
                width: '100%', 
                height: '100px', 
                padding: '8px',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                fontFamily: 'monospace'
              }}
              placeholder="Enter SQL query..."
            />
            
            {/* Sample queries selector */}
            <div style={{ 
              display: 'flex', 
              marginTop: '10px', 
              marginBottom: '10px',
              alignItems: 'center'
            }}>
              <label style={{ marginRight: '8px' }}>Try a sample query: </label>
              <select 
                onChange={(e) => {
                  if (e.target.value) {
                    const selectedQuery = SAMPLE_QUERIES.find(q => q.name === e.target.value);
                    if (selectedQuery) {
                      applySampleQuery(selectedQuery.query);
                    }
                  }
                }}
                style={{
                  padding: '6px',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                }}
                value=""
              >
                <option value="">Select a query...</option>
                {SAMPLE_QUERIES.map(query => (
                  <option key={query.name} value={query.name}>
                    {query.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={executeQuery}
                disabled={isLoading}
              >
                {isLoading ? 'Executing...' : 'Execute Query'}
              </button>
              
              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={loadTables}
                disabled={isLoading}
              >
                Refresh Tables
              </button>
            </div>
          </div>
          
          {/* Query error */}
          {queryError && (
            <div style={{ 
              padding: '10px', 
              marginBottom: '10px',
              color: '#e53e3e', 
              border: '1px solid #f5c2c7', 
              backgroundColor: '#f8d7da', 
              borderRadius: '4px' 
            }}>
              {queryError}
            </div>
          )}
          
          {/* Results table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {queryResults === null ? (
              <p>Execute a query to see results</p>
            ) : queryResults.length === 0 ? (
              <p>Query executed successfully, but returned no rows</p>
            ) : (
              <Table aria-label="Query Results">
                <TableHeader>
                  {columns.map(column => (
                    <Column key={column} id={column}>
                      {column}
                    </Column>
                  ))}
                </TableHeader>
                <TableBody items={queryResults}>
                  {item => (
                    <Row>
                      {columns.map(column => (
                        <Cell key={column}>
                          {formatCellValue(item[column])}
                        </Cell>
                      ))}
                    </Row>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to format cell values for display
function formatCellValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    return JSON.stringify(value);
  }
  
  return String(value);
} 