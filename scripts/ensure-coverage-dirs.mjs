import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const coverageTempDirs = [
  path.join(rootDir, 'coverage', 'frontend', '.tmp'),
  path.join(rootDir, 'coverage', 'server', '.tmp'),
];

for (const dir of coverageTempDirs) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log('Coverage temp directories ensured.');
