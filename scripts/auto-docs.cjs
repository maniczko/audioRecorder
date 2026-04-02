#!/usr/bin/env node

/**
 * Automated Documentation Generator
 *
 * Generates documentation from code comments and structure.
 * Updates README, API docs, and component docs automatically.
 */

const fs = require('fs');
const path = require('path');

console.log('📚 Starting automated documentation generation...\n');

// Configuration
const config = {
  srcDir: 'src',
  serverDir: 'server',
  outputDir: 'docs',
  verbose: process.argv.includes('--verbose'),
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  console.log(`📁 Created output directory: ${config.outputDir}\n`);
}

// Documentation generators
const generators = [
  {
    name: 'API Documentation',
    description: 'Generate API endpoint documentation',
    generate: generateApiDocs,
  },
  {
    name: 'Component Documentation',
    description: 'Generate React component documentation',
    generate: generateComponentDocs,
  },
  {
    name: 'Script Documentation',
    description: 'Generate script/utility documentation',
    generate: generateScriptDocs,
  },
  {
    name: 'README Update',
    description: 'Update main README with project stats',
    generate: generateReadme,
  },
];

// Generate API documentation
function generateApiDocs() {
  console.log('📝 Generating API documentation...');

  const routesDir = path.join(config.serverDir, 'routes');
  const apiDocs = ['# API Documentation\n', 'Auto-generated API documentation.\n'];

  if (fs.existsSync(routesDir)) {
    const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.ts'));

    for (const file of routeFiles) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
      const routes = extractRoutes(content, file);

      if (routes.length > 0) {
        apiDocs.push(`\n## /${file.replace('.ts', '')}\n`);
        apiDocs.push(...routes);
      }
    }
  }

  const outputPath = path.join(config.outputDir, 'API.md');
  fs.writeFileSync(outputPath, apiDocs.join('\n'));
  console.log(`   ✓ Generated: ${outputPath}\n`);
}

// Extract routes from file content
function extractRoutes(content, filename) {
  const routes = [];
  const routeRegex = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
  let match;

  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    routes.push(`- \`${method} ${path}\``);
  }

  return routes;
}

// Generate component documentation
function generateComponentDocs() {
  console.log('📝 Generating component documentation...');

  const componentsDir = path.join(config.srcDir, 'components');
  const componentDocs = [
    '# Component Documentation\n',
    'Auto-generated React component documentation.\n',
  ];

  if (fs.existsSync(componentsDir)) {
    const componentFiles = fs
      .readdirSync(componentsDir)
      .filter((f) => f.endsWith('.tsx') && !f.includes('.test'));

    for (const file of componentFiles) {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf8');
      const component = extractComponent(content, file);

      if (component) {
        componentDocs.push(`\n## ${component.name}\n`);
        componentDocs.push(component.description);
        componentDocs.push(`\n**Props:**\n${component.props}\n`);
      }
    }
  }

  const outputPath = path.join(config.outputDir, 'COMPONENTS.md');
  fs.writeFileSync(outputPath, componentDocs.join('\n'));
  console.log(`   ✓ Generated: ${outputPath}\n`);
}

// Extract component info from file content
function extractComponent(content, filename) {
  const nameMatch = content.match(/export default function (\w+)/);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  const description = extractDescription(content);
  const props = extractProps(content);

  return { name, description, props };
}

// Extract description from JSDoc comment
function extractDescription(content) {
  const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\//);
  if (!jsdocMatch) return 'No description available.';

  const description = jsdocMatch[0]
    .replace(/\/\*\*|\*\//g, '')
    .replace(/\*\s*/g, '')
    .trim();

  return description || 'No description available.';
}

// Extract props from component
function extractProps(content) {
  const propsMatch = content.match(/interface \w+Props \{([\s\S]*?)\}/);
  if (!propsMatch) return 'No props defined.';

  const propsContent = propsMatch[1].trim();
  return '```typescript\n' + propsContent + '\n```';
}

// Generate script documentation
function generateScriptDocs() {
  console.log('📝 Generating script documentation...');

  const scriptsDir = path.join(process.cwd(), 'scripts');
  const scriptDocs = [
    '# Script Documentation\n',
    'Auto-generated script and utility documentation.\n',
  ];

  if (fs.existsSync(scriptsDir)) {
    const scriptFiles = fs
      .readdirSync(scriptsDir)
      .filter((f) => f.endsWith('.js') || f.endsWith('.ts'));

    for (const file of scriptFiles) {
      const content = fs.readFileSync(path.join(scriptsDir, file), 'utf8');
      const description = extractDescription(content);

      scriptDocs.push(`\n## ${file}\n`);
      scriptDocs.push(description);
      scriptDocs.push(`\n**Usage:**\n\`\`\`bash\nnode scripts/${file}\n\`\`\`\n`);
    }
  }

  const outputPath = path.join(config.outputDir, 'SCRIPTS.md');
  fs.writeFileSync(outputPath, scriptDocs.join('\n'));
  console.log(`   ✓ Generated: ${outputPath}\n`);
}

// Generate README update
function generateReadme() {
  console.log('📝 Updating README...');

  const readmePath = path.join(process.cwd(), 'README.md');
  let readme = '';

  if (fs.existsSync(readmePath)) {
    readme = fs.readFileSync(readmePath, 'utf8');
  } else {
    readme = '# VoiceLog Project\n\nAutomated documentation system.\n';
  }

  // Update stats section
  const stats = generateProjectStats();
  const statsSection = `\n## 📊 Project Stats\n\n${stats}\n`;

  if (!readme.includes('## 📊 Project Stats')) {
    readme += statsSection;
  } else {
    readme = readme.replace(/## 📊 Project Stats[\s\S]*?(?=\n## |\n$)/, statsSection.trim());
  }

  // Update automation section
  const automation = generateAutomationList();
  const automationSection = `\n## 🤖 Automation\n\n${automation}\n`;

  if (!readme.includes('## 🤖 Automation')) {
    readme += automationSection;
  } else {
    readme = readme.replace(/## 🤖 Automation[\s\S]*?(?=\n## |\n$)/, automationSection.trim());
  }

  fs.writeFileSync(readmePath, readme);
  console.log(`   ✓ Updated: ${readmePath}\n`);
}

// Generate project statistics
function generateProjectStats() {
  const srcFiles = countFiles(config.srcDir, ['.ts', '.tsx']);
  const serverFiles = countFiles(config.serverDir, ['.ts']);
  const testFiles = countFilesRecursive('**/*.test.ts');

  return [
    `- **Source Files:** ${srcFiles}`,
    `- **Server Files:** ${serverFiles}`,
    `- **Test Files:** ${testFiles}`,
    `- **Test Coverage:** See coverage report`,
  ].join('\n');
}

// Count files in directory
function countFiles(dir, extensions) {
  if (!fs.existsSync(dir)) return 0;

  return fs.readdirSync(dir).filter((f) => {
    const stat = fs.statSync(path.join(dir, f));
    if (stat.isDirectory()) return false;
    return extensions.some((ext) => f.endsWith(ext));
  }).length;
}

// Count files recursively (simplified)
function countFilesRecursive(pattern) {
  // Simplified - would need glob for full implementation
  return 'See test report';
}

// Generate automation list
function generateAutomationList() {
  const automations = [
    '✅ Pre-commit hooks (lint, format, typecheck)',
    '✅ Pre-push hooks (test)',
    '✅ AI auto-fix on PR',
    '✅ Issue-to-PR automation',
    '✅ Security auto-patch (daily)',
    '✅ Optimized CI/CD pipeline',
    '✅ Smart lint staging',
    '✅ Automated documentation',
    '✅ Code migration scripts',
  ];

  return automations.join('\n- ');
}

// Main function
async function runGenerators() {
  console.log('🚀 Running documentation generators...\n');

  for (const generator of generators) {
    try {
      await generator.generate();
    } catch (error) {
      console.error(`❌ Error in ${generator.name}: ${error.message}\n`);
    }
  }

  console.log('✅ Documentation generation complete!\n');
  console.log('📄 Check the docs/ directory for generated documentation.\n');
}

// Run generators
runGenerators().catch((error) => {
  console.error('❌ Documentation generation failed:', error);
  process.exit(1);
});
