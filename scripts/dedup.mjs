import fs from 'fs';
import postcss from 'postcss';

async function dedup() {
  const appCssContent = fs.readFileSync('src/App.css', 'utf8');
  const studioCssContent = fs.readFileSync('src/styles/studio.css', 'utf8');

  let studioRules = new Set();
  const studioRoot = postcss.parse(studioCssContent);
  studioRoot.walk(node => {
    if (node.type === 'rule') {
      const decls = [];
      node.walkDecls(decl => decls.push(`${decl.prop}:${decl.value}`));
      studioRules.add(node.selector.trim() + "|||" + decls.join(';'));
    }
  });

  const appRoot = postcss.parse(appCssContent);
  let removed = 0;
  appRoot.walk(node => {
    if (node.type === 'rule') {
      const decls = [];
      node.walkDecls(decl => decls.push(`${decl.prop}:${decl.value}`));
      const key = node.selector.trim() + "|||" + decls.join(';');
      if (studioRules.has(key)) {
        node.remove();
        removed++;
      }
    }
  });

  fs.writeFileSync('src/App.css', appRoot.toString());
  console.log(`Deduplication complete. Removed ${removed} duplicate rules from App.css.`);
  console.log(`New App.css size: ${fs.statSync('src/App.css').size / 1024} KB`);
  console.log(`studio.css size: ${fs.statSync('src/styles/studio.css').size / 1024} KB`);
}

dedup().catch(console.error);
