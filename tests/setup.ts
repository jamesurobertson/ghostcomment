/**
 * Jest test setup configuration
 */

import { beforeEach, afterEach, jest } from '@jest/globals';

// Mock console methods to reduce test noise
const originalConsole = global.console;

beforeEach(() => {
  // Mock console methods for tests unless VERBOSE_TESTS is set
  if (!process.env.VERBOSE_TESTS) {
    global.console = {
      ...originalConsole,
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  }
});

afterEach(() => {
  // Restore original console
  global.console = originalConsole;
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  // Reset environment to a clean state
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
  };
});

afterEach(() => {
  // Restore original environment
  process.env = originalEnv;
});

// Set test timeout
jest.setTimeout(30000);