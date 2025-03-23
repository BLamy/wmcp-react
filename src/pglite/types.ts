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

type testTrim = Expect<Equal<
  Trim<`  this should remove whitespace  `>,
  `this should remove whitespace`
>>

// Extract the table name from a CREATE TABLE statement
type ExtractTableName<S extends string> =
  S extends `${string}CREATE TABLE IF NOT EXISTS ${infer Table} (${string}`
  ? Trim<Table> : S extends `${string}CREATE TABLE ${infer Table} (${string}`
    ? Trim<Table>
    : never;


type _testExtractTableName = ExtractTableName<'CREATE TABLE IF NOT EXISTS posts (id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, title TEXT NOT NULL, role ENUM(\'user\', \'assistant\') NOT NULL, content TEXT, author_id BIGINT REFERENCES users(id))'>
type testExtractTableName = Expect<Equal<_testExtractTableName, 'posts'>>

// Extract columns section from CREATE TABLE statement
type ExtractColumnsSection<S extends string> =
  S extends `${string}(${infer Columns});`
    ? Trim<Columns>
    : S extends `${string}(${infer Columns})`
      ? Trim<Columns>
      : S extends `${string}(${infer Columns})${Whitespace}`
        ? Trim<Columns>
        : "";

type _testExtractColumnsSection1 = ExtractColumnsSection<`CREATE TABLE posts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  role ENUM('user','assistant') NOT NULL,
  content TEXT,
  author_id BIGINT REFERENCES users(id)
);`>
type testExtractColumnsSection1 = 
  Expect<Equal<
    _testExtractColumnsSection1,
     "id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,\n  title TEXT NOT NULL,\n  role ENUM('user','assistant') NOT NULL,\n  content TEXT,\n  author_id BIGINT REFERENCES users(id)"
  >>

type _testExtractColumnsSection = ExtractColumnsSection<'CREATE TABLE IF NOT EXISTS posts (id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, title TEXT NOT NULL, role ENUM(\'user\', \'assistant\') NOT NULL, content TEXT, author_id BIGINT REFERENCES users(id))'>
type testExtractColumnsSection = Expect<Equal<
  _testExtractColumnsSection, 
  `id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, title TEXT NOT NULL, role ENUM('user', 'assistant') NOT NULL, content TEXT, author_id BIGINT REFERENCES users(id)`
>>

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
  S extends ""
    ? []
    : S extends `${infer Col},${infer Rest}`
      ? Col extends `${string}ENUM(${string}`
        ? Col extends `${infer Before}ENUM(${infer EnumStart}`
          ? EnumStart extends `${string}'${string}'${string})`
            ? [Trim<Col>, ...SplitColumns<Rest>]
            : EnumStart extends `${string}'${string}'${string})`
              ? [Trim<Col>, ...SplitColumns<Rest>]
              : SplitColumnsWithEnum<S>
          : [Trim<Col>, ...SplitColumns<Rest>]
        : [Trim<Col>, ...SplitColumns<Rest>]
      : [Trim<S>];

// Helper to handle ENUM fields separately
type SplitColumnsWithEnum<S extends string> =
  S extends `${infer Before}ENUM(${infer EnumContent})${infer After},${infer Rest}`
    ? [Trim<`${Before}ENUM(${EnumContent})${After}`>, ...SplitColumns<Rest>]
    : [Trim<S>];

type _testSplitColumns = SplitColumns<'id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, title TEXT NOT NULL, role ENUM(\'user\', \'assistant\') NOT NULL, content TEXT, author_id BIGINT REFERENCES users(id)'>
type testSplitColumns = Expect<Equal< 
  _testSplitColumns,
  ["id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY", "title TEXT NOT NULL", "role ENUM('user', 'assistant') NOT NULL", "content TEXT", "author_id BIGINT REFERENCES users(id)"]
>>
// Extract column name from column definition
type ExtractColumnName<S extends string> = 
  S extends `${Whitespace}${infer Rest}` ? ExtractColumnName<Rest> :
  S extends `${infer Name} ${string}` ? Trim<Name> : Trim<S>;

// Parse enum values from ENUM definition
type ParseEnumValues<S extends string> = 
  S extends `'${infer First}'${infer Rest}` 
    ? First | ParseEnumValues<Rest> 
    : S extends `,${Whitespace}'${infer Next}'${infer Rest}` 
      ? Next | ParseEnumValues<Rest> 
      : S extends `,'${infer Next}'${infer Rest}` 
        ? Next | ParseEnumValues<Rest> 
        : never;

type _testParseEnumValues = ParseEnumValues<`'user', 'assistant'`>
type testParseEnumValues = Expect<Equal<
  _testParseEnumValues,
  'user' | 'assistant'
>>

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
  S extends `${string}ENUM${string}(${infer Values})${string}` | `${string}enum${string}(${infer Values})${string}` ? `ENUM(${Values})` :
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
  T extends `VECTOR(${number})` ? number[] :
  T extends "VECTOR" ? number[] :
  T extends "BOOLEAN" ? boolean :
  T extends "TIMESTAMP" ? Date :
  T extends "JSON" | "JSONB" ? Record<string, any> :
  T extends `ENUM(${infer Values})` ? ParseEnumValues<Values> :
  any;

// Process a single column definition
type ProcessColumn<Col extends string> = {
  [K in ExtractColumnName<Col>]: MapSQLType<ExtractColumnType<Col>>
};


type ProcessColumnTest = [
  Expect<Equal<ProcessColumn<'id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY'>['id'], number>>,
  Expect<Equal<ProcessColumn<'role ENUM(\'user\', \'assistant\') NOT NULL'>['role'], 'user' | 'assistant'>>,
  Expect<Equal<ProcessColumn<`role ENUM('user','assistant') NOT NULL`>['role'], 'user' | 'assistant'>>,
  Expect<Equal<ProcessColumn<'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'>['created_at'], Date>>,
]

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
// Process all columns in a table - improved version
type ProcessColumns<Cols extends any[]> = 
  Cols extends [infer First, ...infer Rest]
    ? First extends string
      ? Rest extends any[]
        ? MergeObjects<{ [K in ExtractColumnName<First>]: MapSQLType<ExtractColumnType<First>> }, ProcessColumns<Rest>>
        : { [K in ExtractColumnName<First>]: MapSQLType<ExtractColumnType<First>> }
      : {}
    : {};

type _testColumns = ProcessColumns<SplitColumns<`
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, 
  title TEXT NOT NULL, 
  role ENUM('user', 'assistant') NOT NULL, 
  content TEXT, 
  author_id BIGINT REFERENCES users(id)
`>>
type testColumns = Expect<Equal<
  _testColumns,
  {
    id: number;
    title: string;
    role: 'user' | 'assistant';
  content: string;
  author_id: number;
  }
>>

// Complete column processing for a single table
type ExtractAllColumns<S extends string> = ProcessColumns<SplitColumns<ExtractColumnsSection<S>>>;

type _testExtractAllColumns = ExtractAllColumns<`CREATE TABLE posts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  role ENUM('user','assistant') NOT NULL,
  content TEXT,
  author_id BIGINT REFERENCES users(id)
);`>
type testExtractAllColumns = Expect<Equal<
  _testExtractAllColumns,
  {
    id: number;
    title: string;
    role: 'user' | 'assistant';
    content: string;
    author_id: number;
  }
>>


// Process a single table definition
type ProcessTable<TableSQL extends string> = {
  [TableName in ExtractTableName<TableSQL>]: ExtractAllColumns<TableSQL>
};

// Process multiple tables
type ProcessTables<Tables extends any[]> = 
  Tables extends [infer First, ...infer Rest]
    ? First extends string
      ? Rest extends any[]
        ? ProcessTable<First> & ProcessTables<Rest>
        : ProcessTable<First>
      : {}
    : {};

// Our complete parser
export type ParseSchema<SQL extends string> = ProcessTables<SplitTables<SQL>>;


type testTable = ParseSchema<`CREATE TABLE posts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  role ENUM('user','assistant') NOT NULL,
  content TEXT,
  author_id BIGINT REFERENCES users(id)
);`>['posts']
type ProcessTableTest = [
  Expect<Equal<testTable, {
    id: number;
    title: string;
    role: 'user' | 'assistant';
    content: string;
    author_id: number;
  }>>,
]


type _testTable2 = ParseSchema<`CREATE TABLE posts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  role ENUM('user','assistant') NOT NULL,
  content TEXT,
  author_id BIGINT REFERENCES users(id)
);

CREATE TABLE users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);`>

type testTable2 = [
  Expect<Equal<_testTable2['posts'], {
    id: number;
    title: string;
    role: 'user' | 'assistant';
    content: string;
    author_id: number;
  }>>,
  Expect<Equal<_testTable2['users'], {
    id: number;
    name: string;
    email: string;
  }>>,
]


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
