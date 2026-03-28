import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const child = spawn('node', ['node_modules/vite/bin/vite.js'], {
  cwd: process.cwd(),
  env: { ...process.env },
});

let out = '';
let err = '';

child.stdout.on('data', d => { out += d.toString(); });
child.stderr.on('data', d => { err += d.toString(); });

child.on('close', code => {
  const full = `EXIT: ${code}\n\nSTDOUT:\n${out}\n\nSTDERR:\n${err}`;
  writeFileSync('vite-full-error.txt', full, 'utf-8');
  console.log(full);
});

setTimeout(() => {
  child.kill();
}, 6000);
