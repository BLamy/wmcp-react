import '@testing-library/jest-dom';
import { vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Extend Vitest's expect with Testing Library's matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock window properties that might not exist in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
window.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock IntersectionObserver
window.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn()
}));

// Define missing browser globals
if (typeof global.self === 'undefined') {
  global.self = global.window;
}

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock document.createRange
if (typeof document.createRange === 'undefined') {
  document.createRange = () => {
    const range = {
      setStart: vi.fn(),
      setEnd: vi.fn(),
      commonAncestorContainer: {
        nodeName: '#document',
        ownerDocument: document,
      },
      getBoundingClientRect: vi.fn(),
      getClientRects: () => [],
      createContextualFragment: (html: string) => {
        const template = document.createElement('template');
        template.innerHTML = html;
        return template.content;
      },
    } as unknown as Range;
    return range;
  };
} 