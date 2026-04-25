import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------
// Issue #0 - server test setup exposed the wrong Supabase key name
// Date: 2026-04-05
// Bug: setup.ts only populated SUPABASE_KEY, while the backend storage
//      module reads SUPABASE_SERVICE_ROLE_KEY. Tests that relied on the
//      shared setup could initialize Supabase as unavailable in CI.
// Fix: setup.ts now defines SUPABASE_SERVICE_ROLE_KEY alongside the
//      legacy SUPABASE_KEY alias used elsewhere in older tests.
// ---------------------------------------------------------------
describe('Regression: Issue #0 - server test setup provides Supabase service role key', () => {
  it('exposes both SUPABASE_KEY and SUPABASE_SERVICE_ROLE_KEY for backend tests', () => {
    expect(process.env.SUPABASE_URL).toBe('https://test.supabase.co');
    expect(process.env.SUPABASE_KEY).toBe('test-key');
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe('test-key');
  });

  it('keeps default Supabase storage calls offline and fast', async () => {
    const client = createClient('https://test.supabase.co', 'test-key');

    const result = await client.storage
      .from('recordings')
      .upload('rec1.webm', Buffer.from('audio'), { contentType: 'audio/webm' });

    expect(result.error?.message).toBe('Supabase network disabled in tests');
  });
});
