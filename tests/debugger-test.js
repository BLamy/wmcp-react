// Simple test file for testing the debugger
import { describe, test, expect } from 'vitest';

// Some sample functions to test
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

function divide(a, b) {
  if (b === 0) {
    throw new Error('Cannot divide by zero');
  }
  return a / b;
}

// Tests
describe('Math operations', () => {
  test('add should work correctly', () => {
    const x = 5;
    const y = 10;
    const result = add(x, y);
    expect(result).toBe(15);
  });

  test('multiply should work correctly', () => {
    const x = 5;
    const y = 10;
    const result = multiply(x, y);
    expect(result).toBe(50);
  });

  test('divide should work correctly', () => {
    const x = 10;
    const y = 2;
    const result = divide(x, y);
    expect(result).toBe(5);
  });

  test('divide should throw error when dividing by zero', () => {
    const x = 10;
    const y = 0;
    expect(() => divide(x, y)).toThrow('Cannot divide by zero');
  });
}); 