/// <reference types="vitest" />
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/aria/Button';

afterEach(() => {
  cleanup();
});

describe('Button Component', () => {
  test('renders primary button correctly', () => {
    render(<Button variant="primary">Primary Button</Button>);
    const button = screen.getByRole('button', { name: 'Primary Button' });
    expect(button).toBeDefined();
    expect(button.className).includes('bg-blue-600');
  });

  test('renders secondary button correctly', () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    const button = screen.getByRole('button', { name: 'Secondary Button' });
    expect(button).toBeDefined();
    expect(button.className).includes('bg-gray-100');
  });

  test('renders destructive button correctly', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toBeDefined();
    expect(button.className).includes('bg-red-700');
  });

  test('renders disabled button correctly', () => {
    render(<Button isDisabled>Disabled Button</Button>);
    const button = screen.getByRole('button', { name: 'Disabled Button' });
    expect(button).toBeDefined();
    expect(button).toHaveProperty('disabled', true);
    expect(button.className).includes('bg-gray-100');
  });

  test('handles click events', async () => {
    const handleClick = vi.fn();
    const { container } = render(<Button onPress={handleClick}>Click me</Button>);
    
    const button = container.querySelector('button');
    expect(button).toBeDefined();
    await userEvent.click(button!);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('does not trigger click when disabled', async () => {
    const handleClick = vi.fn();
    const { container } = render(<Button isDisabled onPress={handleClick}>Click me</Button>);
    
    const button = container.querySelector('button[disabled]');
    expect(button).toBeDefined();
    await userEvent.click(button!);
    
    expect(handleClick).not.toHaveBeenCalled();
  });
}); 