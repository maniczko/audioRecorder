// Global test setup - runs before all tests
import { vi } from 'vitest';
import path from 'node:path';

// Mock Supabase credentials for tests
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-key';

// Global state for controlling fs mocks
global.__TEST_FS_STATE__ = {
  existsSync: true,
  statSyncSize: 1234,
};

// Store original fs functions for database operations
let originalFs: any = null;

// Create mock functions that read from global state
const existsSyncMock = vi.fn((filePath?: string) => {
  // Allow database files to be checked
  if (filePath && (filePath.endsWith('.sqlite') || filePath.endsWith('.db'))) {
    return originalFs?.existsSync(filePath) ?? true;
  }
  return global.__TEST_FS_STATE__?.existsSync ?? true;
});

const statSyncMock = vi.fn((filePath?: string) => {
  if (filePath && (filePath.endsWith('.sqlite') || filePath.endsWith('.db'))) {
    return originalFs?.statSync(filePath) ?? { size: 1234 };
  }
  return { size: global.__TEST_FS_STATE__?.statSyncSize ?? 1234 };
});

const createReadStreamMock = vi.fn(() => ({ pipe: vi.fn() }));

const readFileSyncMock = vi.fn((filePath: string, options?: any) => {
  // Allow reading migration files, database, and Dockerfile
  if (
    filePath &&
    (filePath.endsWith('.sql') ||
      filePath.endsWith('.sqlite') ||
      filePath.endsWith('.db') ||
      filePath.endsWith('Dockerfile'))
  ) {
    return originalFs?.readFileSync(filePath, options) ?? Buffer.from('mocked');
  }
  // If encoding is 'utf8' or options has encoding utf8, return string
  const encoding = typeof options === 'string' ? options : options?.encoding;
  if (encoding === 'utf8') {
    return 'mocked content';
  }
  return Buffer.from('mocked');
});

const writeFileSyncMock = vi.fn();
const unlinkSyncMock = vi.fn();
const mkdirSyncMock = vi.fn((dirPath: string, options?: any) => {
  // Allow creating all directories including test uploads
  try {
    return originalFs?.mkdirSync(dirPath, options);
  } catch {
    // Ignore errors in tests
  }
});

const renameSyncMock = vi.fn();
const readdirSyncMock = vi.fn((dirPath?: string, options?: any) => {
  // Allow reading all directories including migrations
  try {
    if (originalFs?.readdirSync) {
      return originalFs.readdirSync(dirPath, options);
    }
  } catch {
    // Return empty array on error
  }
  return [];
});

const rmSyncMock = vi.fn();
const statfsSyncMock = vi.fn(() => ({
  bsize: 4096,
  frsize: 4096,
  blocks: 1000000,
  bfree: 500000,
  bavail: 500000,
}));

// Expose mocks globally for test manipulation
export const __mockFs = {
  existsSync: existsSyncMock,
  statSync: statSyncMock,
  createReadStream: createReadStreamMock,
  readFileSync: readFileSyncMock,
  writeFileSync: writeFileSyncMock,
  unlinkSync: unlinkSyncMock,
  mkdirSync: mkdirSyncMock,
  renameSync: renameSyncMock,
  readdirSync: readdirSyncMock,
  rmSync: rmSyncMock,
  statfsSync: statfsSyncMock,
};

(global as any).__mockFs = __mockFs;

// Mock node:fs globally before any test files are loaded
vi.mock('node:fs', async () => {
  const actualFs = await vi.importActual('node:fs');
  originalFs = actualFs;

  const mockFs = {
    existsSync: existsSyncMock,
    createReadStream: createReadStreamMock,
    statSync: statSyncMock,
    readFileSync: readFileSyncMock,
    writeFileSync: writeFileSyncMock,
    unlinkSync: unlinkSyncMock,
    mkdirSync: mkdirSyncMock,
    renameSync: renameSyncMock,
    readdirSync: readdirSyncMock,
    rmSync: rmSyncMock,
    statfsSync: statfsSyncMock,
  };
  // Also expose as default for compatibility with `import fs from 'node:fs'`
  return {
    ...mockFs,
    default: mockFs,
  };
});

// Mock node:child_process globally
vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd, opts, callback) => {
    // Default implementation - can be overridden in tests
    if (callback) callback(null, '', '');
    return { stdout: { on: vi.fn() }, on: vi.fn() };
  }),
  spawn: vi.fn(() => {
    const { EventEmitter } = require('events');
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stdout.setEncoding = vi.fn();
    // Emit close immediately by default - can be overridden in tests
    setTimeout(() => child.emit('close', 0), 0);
    return child;
  }),
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

// Add type for global state
declare global {
  var __TEST_FS_STATE__: {
    existsSync: boolean;
    statSyncSize: number;
  };
}
