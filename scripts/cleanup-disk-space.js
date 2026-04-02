#!/usr/bin/env node
/**
 * Disk Space Cleanup Script
 * Run this script to clean up old chunk files and free disk space.
 *
 * Usage:
 *   node scripts/cleanup-disk-space.js [maxAgeHours]
 *
 * Examples:
 *   node scripts/cleanup-disk-space.js        # Clean files older than 24h (default)
 *   node scripts/cleanup-disk-space.js 1      # Clean files older than 1h
 *   node scripts/cleanup-disk-space.js 168    # Clean files older than 1 week
 */

import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const uploadDir = process.env.VOICELOG_UPLOAD_DIR || './server/data/uploads';
const chunksDir = path.join(uploadDir, 'chunks');
const maxAgeHours = parseInt(process.argv[2] || '24', 10);

console.log(`🔍 Checking disk space in: ${uploadDir}`);
console.log(`🕐 Cleaning chunks older than ${maxAgeHours} hours...\n`);

if (!existsSync(chunksDir)) {
  console.log('✅ No chunks directory found. Nothing to clean.');
  process.exit(0);
}

const now = Date.now();
const maxAge = maxAgeHours * 60 * 60 * 1000;
let deleted = 0;
let bytesFreed = 0;

try {
  const files = readdirSync(chunksDir);

  for (const file of files) {
    if (!file.endsWith('.chunk')) continue;

    const filePath = path.join(chunksDir, file);
    const stats = statSync(filePath);
    const age = now - stats.mtimeMs;

    if (age > maxAge) {
      bytesFreed += stats.size;
      unlinkSync(filePath);
      deleted++;
      console.log(`🗑️  Deleted: ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Cleanup complete!`);
  console.log(`📊 Deleted ${deleted} files`);
  console.log(`💾 Freed ${(bytesFreed / 1024 / 1024).toFixed(2)} MB`);
  console.log('='.repeat(50));

  // Also check and report disk space
  try {
    const fs = await import('node:fs');
    if (fs.statfsSync) {
      const stats = fs.statfsSync(uploadDir);
      const freeBytes = stats.bavail * stats.bsize;
      const freeGB = (freeBytes / 1024 / 1024 / 1024).toFixed(2);

      console.log(`\n💿 Current free space: ${freeGB} GB`);

      if (freeBytes < 100 * 1024 * 1024) {
        console.log('⚠️  WARNING: Disk space still critically low (< 100MB)');
      } else if (freeBytes < 500 * 1024 * 1024) {
        console.log('⚠️  WARNING: Disk space still low (< 500MB)');
      } else {
        console.log('✅ Disk space is now OK');
      }
    }
  } catch (error) {
    console.log('⚠️  Unable to check current disk space:', error.message);
  }
} catch (error) {
  console.error('❌ Error during cleanup:', error.message);
  process.exit(1);
}
