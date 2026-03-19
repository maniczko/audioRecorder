import fs from 'fs';
import postcss from 'postcss';

const TABS = {
  tasks: ['task', 'kanban', 'board', 'card'],
  recordings: ['recording', 'meeting', 'library', 'recorder'],
  profile: ['profile', 'user-card', 'avatar'],
  auth: ['auth-', 'google-auth'],
  calendar: ['calendar', 'event', 'agenda'],
  people: ['people', 'contact', 'person'],
};

function matchesAny(selector) {
  const matched = new Set();
  for (const [tab, keywords] of Object.entries(TABS)) {
    if (keywords.some(k => selector.includes(`.${k}`) || selector.includes(`#${k}`))) {
      matched.add(tab);
    }
  }
  return Array.from(matched);
}

const plugin = postcss.plugin('splitter', (options) => {
  return (root) => {
    const splits = {};
    Object.keys(TABS).forEach(tab => {
      splits[tab] = postcss.root();
    });
    
    const nodesToRemove = [];
    
    root.each(node => {
      if (node.type === 'rule') {
        let pushed = false;
        node.selectors.forEach(sel => {
          const matched = matchesAny(sel);
          matched.forEach(t => {
            splits[t].append(node.clone());
            pushed = true;
          });
        });
        if (pushed) nodesToRemove.push(node);
      } else if (node.type === 'atrule' && node.name === 'media') {
        let keepMediaNode = false;
        const mediaSplits = {};
        
        node.each(child => {
          if (child.type === 'rule') {
            let pushedInMedia = false;
            child.selectors.forEach(sel => {
              const matched = matchesAny(sel);
              matched.forEach(t => {
                if (!mediaSplits[t]) {
                  mediaSplits[t] = node.clone({ nodes: [] });
                }
                mediaSplits[t].append(child.clone());
                pushedInMedia = true;
              });
            });
            if (pushedInMedia) {
              child.remove();
            } else {
              keepMediaNode = true;
            }
          }
        });
        
        for (const [t, mNode] of Object.entries(mediaSplits)) {
          if (mNode.nodes.length > 0) splits[t].append(mNode);
        }
        
        if (!keepMediaNode || node.nodes.length === 0) {
          nodesToRemove.push(node);
        }
      }
    });
    
    nodesToRemove.forEach(n => n.remove());
    
    for (const [tab, root] of Object.entries(splits)) {
      if (root.nodes.length > 0) {
        const outPath = `./src/styles/${tab}.css`;
        fs.writeFileSync(outPath, root.toString());
        options.stats[tab] = root.nodes.length;
      }
    }
  };
});

async function run() {
  if (!fs.existsSync('src/styles')) {
    fs.mkdirSync('src/styles');
  }

  const parserStats = {};
  
  // Clean first
  Object.keys(TABS).forEach(t => {
    if (fs.existsSync(`src/styles/${t}.css`)) fs.rmSync(`src/styles/${t}.css`);
  });

  const file = 'src/App.css';
  console.log('Processing', file);
  const css = fs.readFileSync(file, 'utf8');
  const result = await postcss([plugin({ stats: parserStats })]).process(css, { from: file });
  
  fs.writeFileSync(file, result.css);

  console.log('Extracted chunks:');
  console.log(parserStats);
}

run();
