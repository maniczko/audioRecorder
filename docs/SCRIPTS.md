# Script Documentation

Auto-generated script and utility documentation.


## auto-docs.js

Automated Documentation Generator
 Generates documentation from code comments and structure.
 Updates README, API docs, and component docs automatically.

**Usage:**
```bash
node scripts/auto-docs.js
```


## cleanup-disk-space.js

Disk Space Cleanup Script
 Run this script to clean up old chunk files and free disk space.
 Usage: 
 node scripts/cleanup-disk-space.js [maxAgeHours]
 Examples:
 node scripts/cleanup-disk-space.js        # Clean files older than 24h (default)
 node scripts/cleanup-disk-space.js 1      # Clean files older than 1h
 node scripts/cleanup-disk-space.js 168    # Clean files older than 1 week

**Usage:**
```bash
node scripts/cleanup-disk-space.js
```


## code-migration.js

Automated Code Migration Script
 Automatically migrates code when dependencies change.
 Detects deprecated APIs and suggests/apply fixes.

**Usage:**
```bash
node scripts/code-migration.js
```


## smart-retry.js

Smart Retry Script
 Runs tests with intelligent retry logic and detailed logging.
 Creates a failure report if tests fail after all retries.

**Usage:**
```bash
node scripts/smart-retry.js
```
