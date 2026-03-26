#!/usr/bin/env node

/**
 * Railway Disk Cleanup Script
 * 
 * Czyści stare pliki tymczasowe i nagrania aby zwolnić miejsce na dysku.
 * Uruchamiane automatycznie przy starcie serwera.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Katalogi do czyszczenia
const DIRECTORIES_TO_CLEAN = [
  './server/data/uploads',
  './server/data/temp',
  './server/data/chunks',
  './server/data/preprocess',
  '/tmp',
];

// Wiek plików do usunięcia (w godzinach)
const MAX_AGE_HOURS = 24;

function getFileAgeHours(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const ageMs = Date.now() - stats.mtimeMs;
    return ageMs / (1000 * 60 * 60);
  } catch {
    return 0;
  }
}

function cleanDirectory(dirPath, maxAgeHours = MAX_AGE_HOURS) {
  if (!fs.existsSync(dirPath)) {
    console.log(`[Cleanup] Directory does not exist: ${dirPath}`);
    return 0;
  }

  let deletedCount = 0;
  let freedBytes = 0;

  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      // Pomijamy ważne pliki
      if (file === '.gitkeep' || file === '.DS_Store') {
        continue;
      }

      const filePath = path.join(dirPath, file);
      
      try {
        const stats = fs.statSync(filePath);
        
        // Czyść tylko pliki (nie foldery)
        if (stats.isFile()) {
          const ageHours = getFileAgeHours(filePath);
          
          // Usuń pliki starsze niż maxAgeHours
          if (ageHours > maxAgeHours) {
            fs.unlinkSync(filePath);
            deletedCount++;
            freedBytes += stats.size;
            console.log(`[Cleanup] Deleted: ${file} (${(stats.size / 1024).toFixed(2)} KB, ${ageHours.toFixed(1)}h old)`);
          }
        }
      } catch (error) {
        // Ignore individual file errors
      }
    }
  } catch (error) {
    console.error(`[Cleanup] Error reading ${dirPath}:`, error.message);
  }

  return { deletedCount, freedBytes };
}

function getDiskUsage() {
  try {
    // Sprawdź dostępną przestrzeń na głównym dysku
    const statfs = fs.statfsSync ? fs.statfsSync('.') : null;
    if (statfs) {
      const freeBytes = statfs.bavail * statfs.bsize;
      const totalBytes = statfs.blocks * statfs.bsize;
      const usedBytes = totalBytes - freeBytes;
      
      return {
        freeGB: (freeBytes / 1024 / 1024 / 1024).toFixed(2),
        usedGB: (usedBytes / 1024 / 1024 / 1024).toFixed(2),
        totalGB: (totalBytes / 1024 / 1024 / 1024).toFixed(2),
        usagePercent: ((usedBytes / totalBytes) * 100).toFixed(1),
      };
    }
  } catch {
    // statfsSync may not be available on all platforms
  }
  
  return null;
}

export function cleanupDisk() {
  console.log('\n🧹 Starting disk cleanup...');
  
  const diskBefore = getDiskUsage();
  if (diskBefore) {
    console.log(`📊 Disk usage before cleanup: ${diskBefore.usedGB}GB / ${diskBefore.totalGB}GB (${diskBefore.usagePercent}%)`);
    console.log(`📊 Free space: ${diskBefore.freeGB}GB\n`);
  }

  let totalDeleted = 0;
  let totalFreed = 0;

  for (const dir of DIRECTORIES_TO_CLEAN) {
    console.log(`[Cleanup] Cleaning: ${dir}`);
    const result = cleanDirectory(dir);
    totalDeleted += result.deletedCount;
    totalFreed += result.freedBytes;
  }

  const diskAfter = getDiskUsage();
  if (diskAfter) {
    console.log(`\n📊 Disk usage after cleanup: ${diskAfter.usedGB}GB / ${diskAfter.totalGB}GB (${diskAfter.usagePercent}%)`);
    console.log(`📊 Free space: ${diskAfter.freeGB}GB`);
  }

  console.log(`\n✅ Cleanup complete: ${totalDeleted} files deleted, ${(totalFreed / 1024 / 1024).toFixed(2)} MB freed`);
  
  return {
    deletedCount: totalDeleted,
    freedBytes: totalFreed,
    diskBefore,
    diskAfter,
  };
}

// Auto-run on import for Railway
if (process.env.RAILWAY === 'true' || process.env.NODE_ENV === 'production') {
  cleanupDisk();
}
