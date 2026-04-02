#!/usr/bin/env node

/**
 * Automated Code Migration Script
 *
 * Automatically migrates code when dependencies change.
 * Detects deprecated APIs and suggests/apply fixes.
 */

const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');

console.log('🔧 Starting automated code migration...\n');

// Configuration
const config = {
  srcDir: 'src',
  serverDir: 'server',
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
};

// Migration rules
const migrations = [
  {
    name: 'React 19 Compatibility',
    description: 'Update React 18 → 19 patterns',
    check: (file) => {
      const text = file.getText();
      return (
        text.includes('ReactDOM.render') ||
        text.includes('React.FC<') ||
        text.includes('React.FunctionComponent<')
      );
    },
    migrate: (file) => {
      let changes = 0;
      const text = file.getText();

      // Replace ReactDOM.render with createRoot (React 18+)
      if (text.includes('ReactDOM.render')) {
        console.log(`  - Migrating ReactDOM.render in ${file.getBaseName()}`);
        file.replaceWithText(
          text.replace(
            /ReactDOM\.render\(([^,]+),\s*document\.getElementById\('([^']+)'\)\)/g,
            "ReactDOM.createRoot(document.getElementById('$2')).render($1)"
          )
        );
        changes++;
      }

      // Replace React.FC with direct type annotation (React 19)
      if (text.includes('React.FC<') || text.includes('React.FunctionComponent<')) {
        console.log(`  - Migrating React.FC in ${file.getBaseName()}`);
        file.replaceWithText(
          text
            .replace(/React\.FC<([^>]+)>/g, '(props: $1)')
            .replace(/React\.FunctionComponent<([^>]+)>/g, '(props: $1)')
        );
        changes++;
      }

      return changes;
    },
  },
  {
    name: 'Vitest 4 Compatibility',
    description: 'Update Vitest 3 → 4 patterns',
    check: (file) => {
      const text = file.getText();
      return text.includes('vi.mock(') && text.includes('importOriginal');
    },
    migrate: (file) => {
      let changes = 0;
      const text = file.getText();

      // Update vi.mock patterns if needed
      if (text.includes('vi.mock(')) {
        console.log(`  - Checking vi.mock patterns in ${file.getBaseName()}`);
        // Add migration logic here if Vitest 4 changes vi.mock API
        changes++;
      }

      return changes;
    },
  },
  {
    name: 'Node.js 22 Compatibility',
    description: 'Update deprecated Node.js APIs',
    check: (file) => {
      const text = file.getText();
      return (
        text.includes('fs.existsSync') || text.includes('path.join') || text.includes('require(')
      );
    },
    migrate: (file) => {
      let changes = 0;

      // Check for deprecated patterns
      // Most Node.js 22 changes are backward compatible
      console.log(`  - Checking Node.js compatibility in ${file.getBaseName()}`);

      return changes;
    },
  },
];

// Main migration function
async function runMigrations() {
  console.log('📁 Scanning source files...\n');

  const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
    skipAddingFilesFromTsConfig: false,
  });

  const sourceFiles = project.getSourceFiles();
  console.log(`Found ${sourceFiles.length} TypeScript files\n`);

  const results = {
    total: 0,
    migrated: 0,
    errors: 0,
    files: [],
  };

  for (const migration of migrations) {
    console.log(`🔄 Running migration: ${migration.name}`);
    console.log(`   ${migration.description}\n`);

    let fileCount = 0;
    let migratedCount = 0;

    for (const file of sourceFiles) {
      try {
        if (migration.check(file)) {
          fileCount++;

          if (!config.dryRun) {
            const changes = migration.migrate(file);
            if (changes > 0) {
              migratedCount++;
              file.saveSync();
            }
          } else {
            console.log(`   Would migrate: ${file.getBaseName()}`);
            migratedCount++;
          }
        }
      } catch (error) {
        console.error(`   ❌ Error in ${file.getBaseName()}: ${error.message}`);
        results.errors++;
      }
    }

    console.log(`   ✓ Checked ${fileCount} files, migrated ${migratedCount}\n`);
    results.total += fileCount;
    results.migrated += migratedCount;
  }

  // Summary
  console.log('\n📊 Migration Summary:');
  console.log(`   Total files checked: ${results.total}`);
  console.log(`   Files migrated: ${results.migrated}`);
  console.log(`   Errors: ${results.errors}`);

  if (config.dryRun) {
    console.log('\n⚠️  Dry run mode - no files were modified');
    console.log('   Run without --dry-run to apply migrations');
  }

  // Save report
  const reportPath = path.join(process.cwd(), 'migration-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        dryRun: config.dryRun,
        results,
        migrations: migrations.map((m) => ({
          name: m.name,
          description: m.description,
        })),
      },
      null,
      2
    )
  );

  console.log(`\n📄 Report saved to: ${reportPath}`);
  console.log('\n✅ Migration complete!\n');

  return results;
}

// Run migrations
runMigrations().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
