import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngSize(path: string) {
  const data = readFileSync(path);
  expect(data.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(data.toString('ascii', 12, 16)).toBe('IHDR');
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

describe('PWA image assets', () => {
  // -----------------------------------------------------------------
  // Issue #0 - manifest icon warning for PNG files containing JPEG bytes
  // Date: 2026-05-21
  // Bug: logo*.png used a PNG extension but served JPEG content.
  // Fix: keep manifest PNG assets as real PNG files with matching sizes.
  // -----------------------------------------------------------------
  test('manifest icons are valid PNG files with matching dimensions', () => {
    expect(readPngSize('public/logo192.png')).toEqual({ width: 192, height: 192 });
    expect(readPngSize('public/logo512.png')).toEqual({ width: 512, height: 512 });
    expect(readPngSize('public/favicon.png')).toEqual({ width: 64, height: 64 });
  });
});
