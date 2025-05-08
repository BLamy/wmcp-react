import { describe, it, expect } from 'vitest';
import { add, subtract, capitalize, reverseString } from './index.js';

describe('Math functions', () => {
  it('adds two numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
    expect(add(0, 0)).toBe(0);
  });

  it('subtracts two numbers correctly', () => {
    expect(subtract(5, 3)).toBe(8);
    expect(subtract(1, 1)).toBe(0);
    expect(subtract(0, 5)).toBe(-5);
  });
});

describe('String functions', () => {
  it('capitalizes the first letter of a string', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('world')).toBe('World');
    expect(capitalize('')).toBe('');
    expect(capitalize(null)).toBe('');
  });

  it('reverses a string correctly', () => {
    expect(reverseString('hello')).toBe('olleh');
    expect(reverseString('12345')).toBe('54321');
    expect(reverseString('')).toBe('');
    expect(reverseString(null)).toBe('');
  });
}); 