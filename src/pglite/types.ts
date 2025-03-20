// types.ts - Type definitions for our parser and database API
import { PGlite } from '@electric-sql/pglite';

// Test helpers
export type Expect<T extends true> = T;
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

// Whitespace handling
type Whitespace = ' ' | '\n' | '\t' | '\r';
type Trim<S extends string> = 
  S extends `${Whitespace}${infer T}` ? Trim<T> :
  S extends `${infer T}${Whitespace}` ? Trim<T> : S;

// Extract the table name from a CREATE TABLE statement
type ExtractTableName<S extends string> =
  S extends `${string}CREATE TABLE ${infer Table} (${string}`
    ? Trim<Table>
    : S extends `${string}CREATE TABLE IF NOT EXISTS ${infer Table} (${string}`
      ? Trim<Table>
      : never;

// Extract columns section from CREATE TABLE statement
type ExtractColumnsSection<S extends string> =
  S extends `${string}(${infer Columns})${string}`
    ? Columns
    : "";

// Split tables by semicolon
type SplitTables<S extends string> = 
  S extends `${infer Table};${infer Rest}`
    ? [Trim<Table>, ...SplitTables<Trim<Rest>>]
    : S extends `${Whitespace}${infer T}` 
      ? SplitTables<T>
      : S extends `${infer T}${Whitespace}` 
        ? SplitTables<T>
        : S extends "" ? [] : [S];

// Split columns by comma
type SplitColumns<S extends string> = 
  S extends `${infer Col},${infer Rest}`
    ? [Trim<Col>, ...SplitColumns<Trim<Rest>>]
    : S extends `${Whitespace}${infer T}` 
      ? SplitColumns<T>
      : S extends `${infer T}${Whitespace}` 
        ? SplitColumns<T>
        : S extends "" ? [] : [S];

// Extract column name from column definition
type ExtractColumnName<S extends string> = 
  S extends `${Whitespace}${infer Rest}` ? ExtractColumnName<Rest> :
  S extends `${infer Name} ${string}` ? Trim<Name> : Trim<S>;

// Extract column type with improved PostgreSQL type detection
type ExtractColumnType<S extends string> = 
  S extends `${string}BIGINT${string}` | `${string}bigint${string}` ? "BIGINT" :
  S extends `${string}INTEGER${string}` | `${string}integer${string}` | `${string}INT${string}` | `${string}int${string}` ? "INTEGER" :
  S extends `${string}TEXT${string}` | `${string}text${string}` ? "TEXT" :
  S extends `${string}VARCHAR${string}` | `${string}varchar${string}` ? "VARCHAR" :
  S extends `${string}VECTOR${string}(${infer Size})${string}` | `${string}vector${string}(${infer Size})${string}` ? `VECTOR(${Size})` :
  S extends `${string}VECTOR${string}` | `${string}vector${string}` ? "VECTOR" :
  S extends `${string}BOOLEAN${string}` | `${string}boolean${string}` ? "BOOLEAN" :
  S extends `${string}TIMESTAMP${string}` | `${string}timestamp${string}` ? "TIMESTAMP" :
  S extends `${string}JSONB${string}` | `${string}jsonb${string}` ? "JSONB" :
  S extends `${string}JSON${string}` | `${string}json${string}` ? "JSON" :
  "unknown";

// Extract vector size for vector types
type ExtractVectorSize<T extends string> = 
  T extends `VECTOR(${infer Size})` ? Size : 
  T extends `vector(${infer Size})` ? Size : 
  "0";

// Map SQL types to TypeScript types
type MapSQLType<T extends string> =
  T extends "BIGINT" | "INTEGER" ? number :
  T extends "TEXT" | "VARCHAR" ? string :
  T extends `VECTOR(${infer Size})` ? number[] :
  T extends "VECTOR" ? number[] :
  T extends "BOOLEAN" ? boolean :
  T extends "TIMESTAMP" ? Date :
  T extends "JSON" | "JSONB" ? Record<string, any> :
  any;

// Process a single column definition
type ProcessColumn<Col extends string> = {
  [K in ExtractColumnName<Col>]: MapSQLType<ExtractColumnType<Col>>
};

// Merge object utility
type MergeObjects<T, U> = {
  [K in keyof T | keyof U]: K extends keyof T 
    ? K extends keyof U 
      ? T[K] | U[K]
      : T[K]
    : K extends keyof U
      ? U[K]
      : never
};

// Process all columns in a table
type ProcessColumns<Cols extends any[]> = 
  Cols extends [infer First, ...infer Rest]
    ? First extends string
      ? Rest extends any[]
        ? MergeObjects<ProcessColumn<First>, ProcessColumns<Rest>>
        : ProcessColumn<First>
      : {}
    : {};

// Complete column processing for a single table
type ExtractAllColumns<S extends string> = ProcessColumns<SplitColumns<ExtractColumnsSection<S>>>;

// Process a single table definition
type ProcessTable<TableSQL extends string> = {
  [TableName in ExtractTableName<TableSQL>]: ExtractAllColumns<TableSQL>
};

// Process multiple tables
type ProcessTables<Tables extends any[]> = 
  Tables extends [infer First, ...infer Rest]
    ? First extends string
      ? Rest extends any[]
        ? MergeObjects<ProcessTable<First>, ProcessTables<Rest>>
        : ProcessTable<First>
      : {}
    : {};

// Our complete parser
export type ParseSchema<SQL extends string> = ProcessTables<SplitTables<SQL>>;

// Database operations interface
export type DBOperations<Schema> = {
  [TableName in keyof Schema]: {
    create: (data: Omit<Schema[TableName], 'id'>) => Promise<Schema[TableName]>;
    findMany: (params?: {
      where?: Partial<Schema[TableName]>,
      orderBy?: { [K in keyof Schema[TableName]]?: 'asc' | 'desc' },
      limit?: number,
      offset?: number
    }) => Promise<Schema[TableName][]>;
    findUnique: (where: { id: number }) => Promise<Schema[TableName] | null>;
    update: (params: {
      where: { id: number },
      data: Partial<Schema[TableName]>
    }) => Promise<Schema[TableName]>;
    delete: (where: { id: number }) => Promise<Schema[TableName]>;
    search?: (
      embedding: number[],
      match_threshold?: number,
      limit?: number
    ) => Promise<Schema[TableName][]>;
  }
};

// Database context type
export interface DatabaseContextType<Schema> {
  db: PGlite | null;
  operations: DBOperations<Schema> | null;
  isInitialized: boolean;
  error: Error | null;
}
