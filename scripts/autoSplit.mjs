import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { globSync } from 'fs'; // Use basic fs/promises if glob not available. Instead we'll implement a simple walker.

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) walkDir(dirPath, callback);
    else callback(path.join(dir, f));
  });
}

async function splitCss() {
  const jsxFiles = [];
  walkDir('src', f => {
    if (f.endsWith('.jsx')) jsxFiles.push(f);
  });

  const classRegex = /[a-zA-Z_][a-zA-Z0-9_-]*/g;
  const classUsage = new Map(); // className -> Set of files

  for (const file of jsxFiles) {
    const code = fs.readFileSync(file, 'utf8');
    const matches = code.match(classRegex) || [];
    for (const match of matches) {
      if (!classUsage.has(match)) classUsage.set(match, new Set());
      classUsage.get(match).add(file);
    }
  }

  const appCssContent = fs.readFileSync('src/styles/studio.css', 'utf8');
  const root = postcss.parse(appCssContent);

  const fileToRules = new Map(); 
  
  // Extract classes from a selector string using parser
  function getClassesFromSelector(selector) {
    const classes = new Set();
    selectorParser(selectors => {
      selectors.walkClasses(node => {
        classes.add(node.value);
      });
    }).processSync(selector);
    return Array.from(classes);
  }

  // Iterate over root nodes (rules, atRules(media queries), comments)
  const appCssNodes = [];
  
  root.nodes.forEach(node => {
    if (node.type === 'comment') {
      appCssNodes.push(node);
      return;
    }
    
    let targetFile = null;

    if (node.type === 'rule') {
      const classes = getClassesFromSelector(node.selector);
      if (classes.length > 0) {
        let possibleFiles = null;
        for (const cls of classes) {
          const filesUsed = classUsage.get(cls) || new Set();
          if (possibleFiles === null) {
            possibleFiles = new Set(filesUsed);
          } else {
            possibleFiles = new Set([...possibleFiles].filter(x => filesUsed.has(x)));
          }
        }
        if (possibleFiles && possibleFiles.size === 1) {
          targetFile = Array.from(possibleFiles)[0];
        }
      }
    } else if (node.type === 'atrule' && node.name === 'media') {
      // media queries logic -> check if all internal rules target the SAME file
      const nestedFiles = new Set();
      let hasGlobal = false;
      node.walkRules(innerRule => {
        const classes = getClassesFromSelector(innerRule.selector);
        if (classes.length > 0) {
          let innerPossible = null;
          for (const cls of classes) {
            const filesUsed = classUsage.get(cls) || new Set();
            if (innerPossible === null) innerPossible = new Set(filesUsed);
            else innerPossible = new Set([...innerPossible].filter(x => filesUsed.has(x)));
          }
          if (innerPossible && innerPossible.size === 1) {
            nestedFiles.add(Array.from(innerPossible)[0]);
          } else {
            hasGlobal = true;
          }
        } else {
          hasGlobal = true;
        }
      });
      if (!hasGlobal && nestedFiles.size === 1) {
        targetFile = Array.from(nestedFiles)[0];
      }
    }

    if (targetFile) {
      if (!fileToRules.has(targetFile)) fileToRules.set(targetFile, []);
      fileToRules.get(targetFile).push(node);
    } else {
      appCssNodes.push(node);
    }
  });

  // Re-assemble CSS
  root.removeAll();
  appCssNodes.forEach(n => root.append(n));
  fs.writeFileSync('src/styles/studio.css', root.toString());

  console.log(`Remaining studio.css rules/nodes: ${appCssNodes.length}`);

  for (const [file, nodes] of fileToRules.entries()) {
    if (nodes.length < 5) {
      // If only a few rules, keep them in App.css to avoid creating a million tiny files
      nodes.forEach(n => root.append(n));
      continue;
    }
    
    const cssFile = file.replace('.jsx', 'Styles.css');
    let cssText = '';
    
    if (fs.existsSync(cssFile)) {
       cssText = fs.readFileSync(cssFile, 'utf8') + '\n';
    }
    
    const newRoot = postcss.root();
    nodes.forEach(n => newRoot.append(n.clone()));
    cssText += newRoot.toString();
    fs.writeFileSync(cssFile, cssText);
    
    // Inject import if not already there
    const code = fs.readFileSync(file, 'utf8');
    const baseName = path.basename(cssFile);
    if (!code.includes(`import './${baseName}';`)) {
      const lines = code.split('\n');
      const lastImportIndex = lines.reduce((acc, line, i) => line.startsWith('import ') ? i : acc, -1);
      lines.splice(lastImportIndex + 1, 0, `import './${baseName}';`);
      fs.writeFileSync(file, lines.join('\n'));
    }
    console.log(`Extracted ${nodes.length} rules into ${cssFile}`);
  }
}

splitCss().catch(console.error);
