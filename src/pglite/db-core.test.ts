import { describe, it, expect } from 'vitest';
import { getTextFields } from './db-core';

describe('getTextFields', () => {
  it('should extract TEXT fields from a simple schema', () => {
    const schema = `
      CREATE TABLE users (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        age INTEGER
      );
    `;
    
    const textFields = getTextFields(schema, 'users');
    expect(textFields).toEqual(['name', 'email']);
  });

  it('should handle case insensitivity in TEXT type', () => {
    const schema = `
      CREATE TABLE notes (
        id BIGINT PRIMARY KEY,
        title Text NOT NULL,
        content TEXT,
        tags text
      );
    `;
    
    const textFields = getTextFields(schema, 'notes');
    expect(textFields).toEqual(['title', 'content', 'tags']);
  });

  it('should handle "IF NOT EXISTS" in table definition', () => {
    const schema = `
      CREATE TABLE IF NOT EXISTS messages (
        id BIGINT PRIMARY KEY,
        sender TEXT,
        body TEXT,
        timestamp TIMESTAMP
      );
    `;
    
    const textFields = getTextFields(schema, 'messages');
    expect(textFields).toEqual(['sender', 'body']);
  });

  it('should return empty array for non-existent table', () => {
    const schema = `
      CREATE TABLE users (
        id BIGINT PRIMARY KEY,
        name TEXT
      );
    `;
    
    const textFields = getTextFields(schema, 'non_existent_table');
    expect(textFields).toEqual([]);
  });

  it('should handle complex schema with multiple tables', () => {
    const schema = `
      CREATE TABLE users (
        id BIGINT PRIMARY KEY,
        name TEXT,
        email TEXT
      );
      
      CREATE TABLE posts (
        id BIGINT PRIMARY KEY,
        title TEXT,
        content TEXT,
        user_id BIGINT
      );
    `;
    
    const userTextFields = getTextFields(schema, 'users');
    expect(userTextFields).toEqual(['name', 'email']);
    
    const postTextFields = getTextFields(schema, 'posts');
    expect(postTextFields).toEqual(['title', 'content']);
  });


  it('should handle complex schema with multiple tables', () => {
    const schema = `
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
    
    const envGroupTextFields = getTextFields(schema, 'env_groups');
    expect(envGroupTextFields).toEqual(['name', 'description']);
    
    const envVariableTextFields = getTextFields(schema, 'env_variables');
    expect(envVariableTextFields).toEqual(['key', 'value']);
  });

  it('should handle column definitions with constraints', () => {
    const schema = `
      CREATE TABLE products (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        sku VARCHAR(50)
      );
    `;
    
    const textFields = getTextFields(schema, 'products');
    expect(textFields).toEqual(['name', 'description']);
  });
});
