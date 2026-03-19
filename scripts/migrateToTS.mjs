import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist') walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

// 1. Rename files safely
function migrate() {
  const files = [];
  walkDir('src', f => files.push(f));
  walkDir('server', f => files.push(f));

  let renamed = 0;

  files.forEach(file => {
    if (!file.endsWith('.js') && !file.endsWith('.jsx')) return;
    if (file === 'src\\setupTests.js' || file === 'src/setupTests.js') return;
    if (file === 'src\\reportWebVitals.js' || file === 'src/reportWebVitals.js') return;
    if (file.includes('e2e') || file.includes('playwright')) return;

    const content = fs.readFileSync(file, 'utf8');
    const hasJSX = content.includes('/>') || content.match(/<\w+/) || file.endsWith('.jsx');
    
    let newExt = hasJSX ? '.tsx' : '.ts';
    if (file.endsWith('.test.js')) newExt = hasJSX ? '.test.tsx' : '.test.ts';
    if (file.endsWith('.test.jsx')) newExt = '.test.tsx';
    
    // Server files shouldn't be tsx
    if (file.startsWith('server') || file.startsWith('server\\')) newExt = file.includes('.test.') ? '.test.ts' : '.ts';

    const newPath = file.replace(/\.jsx?$/, newExt);
    
    if (file !== newPath) {
      fs.renameSync(file, newPath);
      console.log(`Renamed: ${file} -> ${newPath}`);
      renamed++;
    }
  });

  console.log(`\nRenamed ${renamed} files to TypeScript extensions.`);

  // 2. Update index.html
  const htmlPath = 'index.html';
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('src/index.jsx', 'src/index.tsx');
    html = html.replace('src/index.js', 'src/index.tsx');
    fs.writeFileSync(htmlPath, html);
    console.log('Updated index.html to .tsx');
  }

  // 3. Update package.json scripts for running ts-node / tsx
  const pkgPath = 'package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.scripts['start:server'] = "tsx server/index.ts";
    pkg.scripts['start:server:watch'] = "tsx --watch server/index.ts";
    // Setup generic tsc validation
    pkg.scripts['typecheck'] = "tsc --noEmit";
    pkg.scripts['test'] = "npm run typecheck && npm run lint && vitest run && npm run build";
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('Updated package.json scripts for TSX and typecheck');
  }
}

migrate();
