// Global test setup - runs before all tests
import { vi } from 'vitest';

// Global state for controlling fs mocks
global.__TEST_FS_STATE__ = {
  existsSync: true,
  statSyncSize: 1234,
};

// Create mock functions that read from global state
const existsSyncMock = vi.fn(() => global.__TEST_FS_STATE__?.existsSync ?? true);
const statSyncMock = vi.fn(() => ({ size: global.__TEST_FS_STATE__?.statSyncSize ?? 1234 }));
const createReadStreamMock = vi.fn(() => ({ pipe: vi.fn() }));
const readFileSyncMock = vi.fn(() => Buffer.from('mocked'));
const writeFileSyncMock = vi.fn();
const unlinkSyncMock = vi.fn();
const mkdirSyncMock = vi.fn();
const renameSyncMock = vi.fn();

// Expose mocks globally for test manipulation
(global as any).__mockFs = {
  existsSync: existsSyncMock,
  statSync: statSyncMock,
  createReadStream: createReadStreamMock,
  readFileSync: readFileSyncMock,
  writeFileSync: writeFileSyncMock,
  unlinkSync: unlinkSyncMock,
  mkdirSync: mkdirSyncMock,
  renameSync: renameSyncMock,
};

// Mock node:fs globally before any test files are loaded
vi.mock('node:fs', () => {
  const mockFs = {
    existsSync: existsSyncMock,
    createReadStream: createReadStreamMock,
    statSync: statSyncMock,
    readFileSync: readFileSyncMock,
    writeFileSync: writeFileSyncMock,
    unlinkSync: unlinkSyncMock,
    mkdirSync: mkdirSyncMock,
    renameSync: renameSyncMock,
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
