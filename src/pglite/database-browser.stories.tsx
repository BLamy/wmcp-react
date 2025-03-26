import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { DatabaseBrowser } from './database-browser';

// The schema used for the database browser stories
const EXAMPLE_SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    username TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS posts (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title TEXT NOT NULL,
    content TEXT,
    user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS comments (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    content TEXT NOT NULL,
    post_id BIGINT REFERENCES posts(id),
    user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS embeddings (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    content TEXT NOT NULL,
    embedding VECTOR(384)
  );
  
  -- Insert some example data
  INSERT INTO users (username, email) VALUES 
    ('john_doe', 'john@example.com'),
    ('jane_smith', 'jane@example.com'),
    ('bob_jones', 'bob@example.com')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO posts (title, content, user_id) VALUES 
    ('First Post', 'This is my first post content', 1),
    ('Hello World', 'Introduction to the world of blogging', 2),
    ('Database Browser', 'Testing the new database browser', 1)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO comments (content, post_id, user_id) VALUES 
    ('Great post!', 1, 2),
    ('Thanks for sharing', 1, 3),
    ('I learned something new', 2, 1)
  ON CONFLICT DO NOTHING;
`;

// Sample SQL queries that users can try
const SAMPLE_QUERIES = [
  {
    name: "Basic SELECT",
    query: "SELECT * FROM users LIMIT 10"
  },
  {
    name: "Count rows",
    query: "SELECT COUNT(*) as count FROM users"
  },
  {
    name: "JOIN Example",
    query: `
      SELECT 
        p.id as post_id, 
        p.title, 
        u.username as author,
        COUNT(c.id) as comment_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN comments c ON c.post_id = p.id
      GROUP BY p.id, p.title, u.username
      ORDER BY p.id
    `
  },
  {
    name: "Filtered Query",
    query: `
      SELECT p.* 
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE u.username = 'john_doe'
    `
  },
  {
    name: "Schema Information",
    query: `
      SELECT 
        table_name,
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM 
        information_schema.columns
      WHERE 
        table_schema = 'public'
      ORDER BY 
        table_name, ordinal_position
    `
  },
  {
    name: "Table Constraints",
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
        t.relname = 'users'
    `
  }
];

const meta: Meta<typeof DatabaseBrowser> = {
  title: 'PGlite/Database Browser',
  component: DatabaseBrowser,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
          # Database Browser Component
          
          This component provides a simple interface for browsing and querying an in-browser PostgreSQL database
          powered by PGlite.
          
          ## Features
          
          - View list of all tables in the database
          - Browse table contents
          - Run custom SQL queries
          - Display results in a tabular format
          - Sample query templates for common operations
          
          ## Usage
          
          The database browser can be integrated into your application to allow users to explore the data stored
          in the browser and execute SQL queries:
          
          \`\`\`tsx
          import { DatabaseBrowser } from './pglite';
          
          function App() {
            return (
              <DatabaseBrowser 
                schema="CREATE TABLE ..." 
                dbName="my-database" 
              />
            );
          }
          \`\`\`
          
          ## Sample Queries
          
          Try these queries in the database browser:
          
          ${SAMPLE_QUERIES.map(q => `### ${q.name}\n\`\`\`sql\n${q.query}\n\`\`\``).join('\n\n')}
        `
      }
    }
  },
  args: {
    schema: EXAMPLE_SCHEMA,
    dbName: 'browser-story-db',
    debug: true
  }
};

export default meta;
type Story = StoryObj<typeof DatabaseBrowser>;

export const Default: Story = {
  name: 'Database Browser',
  parameters: {
    docs: {
      description: {
        story: `
          Basic database browser with blog demo schema including users, posts, and comments.
          
          ### Features in this version:
          - Table list in sidebar for easy navigation
          - SQL query editor with syntax highlighting
          - Results displayed in an interactive table
          - Error handling for invalid queries
          - Sample query dropdown for quick testing
        `
      }
    }
  }
};

export const WithCustomSchema: Story = {
  name: 'With Custom Schema',
  parameters: {
    docs: {
      description: {
        story: 'Database browser with e-commerce schema including products, categories, and relationships.'
      }
    }
  },
  args: {
    debug: true,
    schema: `
      CREATE TABLE IF NOT EXISTS products (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name TEXT NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        description TEXT,
        in_stock BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS categories (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name TEXT NOT NULL,
        description TEXT
      );
      
      CREATE TABLE IF NOT EXISTS product_categories (
        product_id BIGINT REFERENCES products(id),
        category_id BIGINT REFERENCES categories(id),
        PRIMARY KEY (product_id, category_id)
      );
      
      -- Insert sample data
      INSERT INTO products (name, price, description) VALUES 
        ('Laptop', 999.99, 'Powerful laptop for developers'),
        ('Smartphone', 699.99, 'Latest smartphone model'),
        ('Headphones', 149.99, 'Noise-cancelling headphones')
      ON CONFLICT DO NOTHING;
      
      INSERT INTO categories (name, description) VALUES 
        ('Electronics', 'Electronic devices and gadgets'),
        ('Computers', 'Laptops, desktops and accessories'),
        ('Audio', 'Speakers, headphones and sound equipment')
      ON CONFLICT DO NOTHING;
      
      INSERT INTO product_categories VALUES 
        (1, 1), (1, 2), (2, 1), (3, 1), (3, 3)
      ON CONFLICT DO NOTHING;
    `,
    dbName: 'product-catalog-db'
  }
};

export const EmptyDatabase: Story = {
  name: 'Empty Database',
  parameters: {
    docs: {
      description: {
        story: 'Database browser with minimal schema, showing how it handles an empty database.'
      }
    }
  },
  args: {
    schema: `
      -- This schema only creates empty tables with no data
      CREATE TABLE IF NOT EXISTS empty_table_1 (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name TEXT,
        description TEXT
      );
      
      CREATE TABLE IF NOT EXISTS empty_table_2 (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        value INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
    dbName: 'empty-db'
  }
}; 