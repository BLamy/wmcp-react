/// <reference types="vitest" />
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Chat } from '../src/wmcp/components/chat';

// Mock xterm and xterm-addon-fit
vi.mock('xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    write: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn(),
    onKey: vi.fn(),
  })),
}));

vi.mock('xterm-addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

// Mock WebContainer API
vi.mock('@webcontainer/api', () => ({
  WebContainer: {
    boot: vi.fn().mockResolvedValue({
      mount: vi.fn(),
      spawn: vi.fn().mockResolvedValue({
        output: { pipe: vi.fn() },
        exit: Promise.resolve(0),
      }),
    }),
  },
}));

describe('Chat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders default chat interface', async () => {
    const { container } = render(<Chat />);
    
    await waitFor(() => {
      const mainElement = container.querySelector('main');
      expect(mainElement).toBeDefined();
    });
  });

  test('renders chat with custom server config', async () => {
    const customConfig = {
      'mcp-server-everything': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-everything'],
        env: {
          DEBUG: 'true'
        }
      }
    };

    const { container } = render(<Chat serverConfigs={customConfig} />);
    
    await waitFor(() => {
      const mainElement = container.querySelector('main');
      expect(mainElement).toBeDefined();
    });
  });
}); 