import fs from 'node:fs';
import path from 'node:path';

const dashboardTestFiles = [
  'scripts/dashboard-services.test.ts',
  'scripts/test-dashboard-pro.test.ts',
];

const generatedSnapshots = [
  'external-services.js',
  'external-services.json',
  'test-results.js',
  'test-results.json',
];

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Regression: #0 - workflow dashboard tests are hermetic', () => {
  it.each(dashboardTestFiles)('does not read generated dashboard snapshots in %s', (file) => {
    const source = readProjectFile(file);

    for (const snapshot of generatedSnapshots) {
      expect(source).not.toContain(`'${snapshot}'`);
      expect(source).not.toContain(`"${snapshot}"`);
      expect(source).not.toContain(`\`${snapshot}\``);
    }
  });

  it('keeps the deterministic dashboard fixture tracked in source', () => {
    const fixturePath = path.resolve(process.cwd(), 'scripts', 'fixtures', 'dashboard-fixtures.ts');
    const fixtureSource = fs.readFileSync(fixturePath, 'utf8');

    expect(fixtureSource).toContain('externalServicesFixture');
    expect(fixtureSource).toContain('testResultsFixture');
    expect(fixtureSource).toContain('latest_by_workflow');
  });
});
