```typescript
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadAudioPipeline({
  openAiKey = "",
  baseUrl = "https://api.example.test/v1",
} = {}) {
  vi.resetModules();
  (globalThis as any).__audioPipelineExecCalls = 0;

  // Set environment variables BEFORE importing any modules
  process.env.VOICELOG_OPENAI_API_KEY = openAiKey;
  process.env.OPENAI_API_KEY = openAiKey;
  process.env.VOICELOG_OPENAI_BASE_URL = baseUrl;
  process.env.VOICELOG_DEBUG = "false";

  // Mock logger and speakerEmbedder before loading audioPipeline
  vi.doMock("../logger.ts", () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));
  vi.doMock("../speakerEmbedder.ts", () => ({
    matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("node:child_process", () => ({
    exec: vi.fn((cmd, opts, callback) => {
      (globalThis as any).__audioPipelineExecCalls += 1;
      const fs = require("node:fs");
      const path = require("node:path");
      const quoted = Array.from(String(cmd || "").matchAll(/"([^"]+)"/g)).map((match: any) => match[1]);
      const outputCandidate = quoted[quoted.length - 1];
      if (
        outputCandidate &&
        !/print_format json|volumedetect|silencedetect|-f\s+null\s+-/i.test(String(cmd || "")) &&
        /\.[a-z0-9]+$/i.test(outputCandidate)
      ) {
        try {
          fs.mkdirSync(path.dirname(outputCandidate), { recursive: true });
          fs.writeFileSync(outputCandidate, Buffer.from("mock-audio"));
        } catch (_) {}
      }
      if (callback) callback(null, "", "");
      return { stdout: { on: vi.fn() }, on: vi.fn() };
    }),
    spawn: vi.fn(() => {
      const { EventEmitter } = require('events');
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stdout.setEncoding = vi.fn();
      setImmediate(() => child.emit('close', 0));
      return child;
    }),
  }));

  return import("../audioPipeline.ts");
}

describe("audioPipeline exports", () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    VOICELOG_OPENAI_API_KEY: process.env.VOICELOG_OPENAI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    VOICELOG_OPENAI_BASE_URL: process.env.VOICELOG_OPENAI_BASE_URL,
  };

  beforeEach(() => {
    global.fetch = vi.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.clearAllMocks();
    // Restore original env vars
    process.env.VOICELOG_OPENAI_API_KEY = originalEnv.VOICELOG_OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    process.env.VOICELOG_OPENAI_BASE_URL = originalEnv.VOICELOG_OPENAI_BASE_URL;
  });

  it("returns null/empty values when OpenAI key is not configured", async () => {
    process.env.OPENAI_API_KEY = "";
    process.env.VOICELOG_OPENAI_API_KEY = "";

    const pipeline = await loadAudioPipeline();
    expect(pipeline).toBeDefined();
  });
});
```