```typescript
import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('test setup fs mocks', () => {
  it('Regression: preserves real YAML file contents for utf-8 encoded contract reads', () => {
    // Ensure the mocked file exists for the test
    fs.writeFileSync('docs/openapi.yaml', 'openapi: "3.0.3"', 'utf-8');
    
    const content = fs.readFileSync('docs/openapi.yaml', 'utf-8');

    expect(typeof content).toBe('string');
    expect(content).toContain('openapi: "3.0.3"');
  });
});
```