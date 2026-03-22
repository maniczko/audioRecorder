# 🧪 SZCZEGÓŁOWY PLAN POKRYCIA TESTÓW - SERVER

## 📊 Aktualny status

| Plik | Coverage | Status | Priorytet |
|------|----------|--------|-----------|
| `audioPipeline.ts` | 22% | 🔴 | **P0** |
| `sqliteWorker.ts` | 0% | 🔴 | **P0** |
| `supabaseStorage.ts` | 26% | 🔴 | **P0** |
| `database.ts` | 56% | 🟡 | P1 |
| `TranscriptionService.ts` | 68% | 🟡 | P1 |
| `speakerEmbedder.ts` | 68% | 🟡 | P1 |
| `logger.ts` | 46% | 🔴 | P2 |
| `index.ts` | 61% | 🟡 | P2 |

---

## 🎯 PRIORYTET 1: `audioPipeline.ts` (22% → 80%)

### 🔹 Funkcje czyste (unit tests) - **2 dni**

#### 1. `buildWhisperPrompt()` 
```typescript
// server/tests/audioPipeline/buildWhisperPrompt.test.ts
describe('buildWhisperPrompt', () => {
  it('returns default prompt when no metadata provided', () => {
    expect(buildWhisperPrompt({})).toContain('Transkrypcja spotkania biznesowego');
  });

  it('includes meeting title when provided', () => {
    const prompt = buildWhisperPrompt({ meetingTitle: 'Sprint Planning' });
    expect(prompt).toContain('Spotkanie: Sprint Planning.');
  });

  it('includes participants (max 8)', () => {
    const participants = ['Anna', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivan'];
    const prompt = buildWhisperPrompt({ participants });
    expect(prompt).toContain('Uczestnicy:');
    expect(prompt).not.toContain('Ivan'); // 9th participant excluded
  });

  it('includes tags (max 6)', () => {
    const tags = ['budget', 'timeline', 'resources', 'risks', 'stakeholders', 'deliverables', 'extra'];
    const prompt = buildWhisperPrompt({ tags });
    expect(prompt).toContain('Tematy:');
    expect(prompt).not.toContain('extra');
  });

  it('truncates long meeting title to 80 chars', () => {
    const longTitle = 'A'.repeat(150);
    const prompt = buildWhisperPrompt({ meetingTitle: longTitle });
    expect(prompt).toContain('Spotkanie: ' + 'A'.repeat(80) + '.');
  });

  it('truncates vocabulary to 200 chars', () => {
    const vocab = 'B'.repeat(300);
    const prompt = buildWhisperPrompt({ vocabulary: vocab });
    expect(prompt).toContain('B'.repeat(200));
  });

  it('handles empty arrays gracefully', () => {
    const prompt = buildWhisperPrompt({ 
      participants: [], 
      tags: [] 
    });
    expect(prompt).not.toContain('Uczestnicy:');
    expect(prompt).not.toContain('Tematy:');
  });

  it('handles null/undefined values', () => {
    expect(() => buildWhisperPrompt(null)).not.toThrow();
    expect(() => buildWhisperPrompt(undefined)).not.toThrow();
  });
});
```

#### 2. `isHallucination()`
```typescript
// server/tests/audioPipeline/isHallucination.test.ts
describe('isHallucination', () => {
  it('detects English filler phrases', () => {
    expect(isHallucination('Thank you.')).toBe(true);
    expect(isHallucination('Thanks for watching!')).toBe(true);
    expect(isHallucination('Please like and subscribe.')).toBe(true);
  });

  it('detects Polish filler phrases', () => {
    expect(isHallucination('Dziękuję.')).toBe(true);
    expect(isHallucination('Do widzenia.')).toBe(true);
    expect(isHallucination('Na razie.')).toBe(true);
  });

  it('detects music/non-speech markers', () => {
    expect(isHallucination('[Music]')).toBe(true);
    expect(isHallucination('[Applause]')).toBe(true);
    expect(isHallucination('♪')).toBe(true);
  });

  it('detects punctuation-only text', () => {
    expect(isHallucination('...')).toBe(true);
    expect(isHallucination('!?')).toBe(true);
    expect(isHallucination(',;:')).toBe(true);
  });

  it('detects repetition artifacts', () => {
    expect(isHallucination('mmmm.')).toBe(true);
    expect(isHallucination('hmmm.')).toBe(true);
    expect(isHallucination('uhhh.')).toBe(true);
  });

  it('returns false for valid speech', () => {
    expect(isHallucination('To jest normalne zdanie.')).toBe(false);
    expect(isHallucination('Spotkanie rozpoczęło się o 10:00.')).toBe(false);
  });

  it('returns true for empty/short text', () => {
    expect(isHallucination('')).toBe(true);
    expect(isHallucination('a')).toBe(true);
  });
});
```

#### 3. `textSimilarity()`
```typescript
// server/tests/audioPipeline/textSimilarity.test.ts
describe('textSimilarity', () => {
  it('returns 1 for identical texts', () => {
    expect(textSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('returns 0 for completely different texts', () => {
    expect(textSimilarity('apple', 'orange')).toBeCloseTo(0, 1);
  });

  it('handles partial matches', () => {
    const similarity = textSimilarity('hello world foo', 'hello world bar');
    expect(similarity).toBeGreaterThan(0.5);
    expect(similarity).toBeLessThan(1);
  });

  it('is case insensitive', () => {
    expect(textSimilarity('HELLO', 'hello')).toBe(1);
  });

  it('ignores punctuation', () => {
    expect(textSimilarity('hello!', 'hello')).toBe(1);
    expect(textSimilarity('hello, world', 'hello world')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(textSimilarity('', 'hello')).toBe(0);
    expect(textSimilarity('', '')).toBe(0);
  });
});
```

#### 4. `mergeShortSegments()`
```typescript
// server/tests/audioPipeline/mergeShortSegments.test.ts
describe('mergeShortSegments', () => {
  it('returns single segment unchanged', () => {
    const segments = [{ text: 'Hello', timestamp: 0, endTimestamp: 5, speakerId: 0 }];
    expect(mergeShortSegments(segments)).toEqual(segments);
  });

  it('merges consecutive short segments from same speaker', () => {
    const segments = [
      { text: 'Hello', timestamp: 0, endTimestamp: 0.5, speakerId: 0 },
      { text: 'world', timestamp: 0.6, endTimestamp: 1, speakerId: 0 },
    ];
    const result = mergeShortSegments(segments, 1.2);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Hello world');
  });

  it('does not merge segments from different speakers', () => {
    const segments = [
      { text: 'Hello', timestamp: 0, endTimestamp: 0.5, speakerId: 0 },
      { text: 'Hi', timestamp: 0.6, endTimestamp: 1, speakerId: 1 },
    ];
    const result = mergeShortSegments(segments, 1.2);
    expect(result).toHaveLength(2);
  });

  it('does not merge long segments', () => {
    const segments = [
      { text: 'Hello', timestamp: 0, endTimestamp: 2, speakerId: 0 },
      { text: 'world', timestamp: 2.1, endTimestamp: 4, speakerId: 0 },
    ];
    const result = mergeShortSegments(segments, 1.2);
    expect(result).toHaveLength(2);
  });

  it('preserves verification status', () => {
    const segments = [
      { text: 'Hello', timestamp: 0, endTimestamp: 0.5, speakerId: 0, verificationStatus: 'review' },
      { text: 'world', timestamp: 0.6, endTimestamp: 1, speakerId: 0, verificationStatus: 'verified' },
    ];
    const result = mergeShortSegments(segments, 1.2);
    expect(result[0].verificationStatus).toBe('review'); // Lower status preserved
  });
});
```

#### 5. `normalizeText()` i `tokenize()`
```typescript
// server/tests/audioPipeline/textUtils.test.ts
describe('normalizeText', () => {
  it('converts to lowercase', () => {
    expect(normalizeText('HELLO')).toBe('hello');
  });

  it('removes punctuation', () => {
    expect(normalizeText('Hello, World!')).toBe('hello world');
  });

  it('normalizes whitespace', () => {
    expect(normalizeText('  hello   world  ')).toBe('hello world');
  });

  it('handles Polish characters', () => {
    expect(normalizeText('Cześć! Jak się masz?')).toBe('cześć jak się masz');
  });
});

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(tokenize('hello world foo')).toEqual(['hello', 'world', 'foo']);
  });

  it('removes empty tokens', () => {
    expect(tokenize('hello   world')).toEqual(['hello', 'world']);
  });
});
```

---

### 🔹 Funkcje z zależnościami (integration tests) - **3 dni**

#### 6. `runPyannoteDiarization()`
```typescript
// server/tests/audioPipeline/runPyannoteDiarization.test.ts
describe('runPyannoteDiarization', () => {
  it('returns null when HF_TOKEN is not configured', async () => {
    process.env.HF_TOKEN = '';
    const result = await runPyannoteDiarization('/tmp/audio.wav', null);
    expect(result).toBeNull();
  });

  it('returns null when diarize.py not found', async () => {
    process.env.HF_TOKEN = 'test-token';
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const result = await runPyannoteDiarization('/tmp/audio.wav', null);
    expect(result).toBeNull();
  });

  it('runs Python subprocess and parses JSON output', async () => {
    const mockSpawn = vi.spyOn(childProcess, 'spawn');
    const mockChild = new EventEmitter() as any;
    mockChild.stdout = new EventEmitter();
    mockChild.stdout.setEncoding = vi.fn();
    mockSpawn.mockReturnValue(mockChild);

    const resultPromise = runPyannoteDiarization('/tmp/audio.wav', null);

    // Simulate Python output
    mockChild.stdout.emit('data', '[{"speaker": "SPEAKER_00", "start": 0, "end": 5}]');
    mockChild.emit('close', 0);

    const result = await resultPromise;
    expect(result).toEqual([{ speaker: 'SPEAKER_00', start: 0, end: 5 }]);
  });

  it('handles Python subprocess errors gracefully', async () => {
    const mockSpawn = vi.spyOn(childProcess, 'spawn');
    const mockChild = new EventEmitter() as any;
    mockSpawn.mockReturnValue(mockChild);

    const resultPromise = runPyannoteDiarization('/tmp/audio.wav', null);
    mockChild.emit('error', new Error('Python not found'));

    const result = await resultPromise;
    expect(result).toBeNull();
  });

  it('handles invalid JSON from Python', async () => {
    const mockSpawn = vi.spyOn(childProcess, 'spawn');
    const mockChild = new EventEmitter() as any;
    mockChild.stdout = new EventEmitter();
    mockChild.stdout.setEncoding = vi.fn();
    mockSpawn.mockReturnValue(mockChild);

    const resultPromise = runPyannoteDiarization('/tmp/audio.wav', null);
    mockChild.stdout.emit('data', 'not valid json');
    mockChild.emit('close', 0);

    const result = await resultPromise;
    expect(result).toBeNull();
  });
});
```

#### 7. `runSileroVAD()`
```typescript
// server/tests/audioPipeline/runSileroVAD.test.ts
describe('runSileroVAD', () => {
  it('returns null when VAD is disabled', async () => {
    process.env.VAD_ENABLED = 'false';
    const result = await runSileroVAD('/tmp/audio.wav', null);
    expect(result).toBeNull();
  });

  it('returns null when vad.py not found', async () => {
    process.env.VAD_ENABLED = 'true';
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const result = await runSileroVAD('/tmp/audio.wav', null);
    expect(result).toBeNull();
  });

  it('returns speech segments from Python subprocess', async () => {
    const mockSpawn = vi.spyOn(childProcess, 'spawn');
    const mockChild = new EventEmitter() as any;
    mockChild.stdout = new EventEmitter();
    mockChild.stdout.setEncoding = vi.fn();
    mockSpawn.mockReturnValue(mockChild);

    const resultPromise = runSileroVAD('/tmp/audio.wav', null);
    mockChild.stdout.emit('data', '[{"start": 0.5, "end": 3.2}]');
    mockChild.emit('close', 0);

    const result = await resultPromise;
    expect(result).toEqual([{ start: 0.5, end: 3.2 }]);
  });
});
```

#### 8. `mergeWithPyannote()`
```typescript
// server/tests/audioPipeline/mergeWithPyannote.test.ts
describe('mergeWithPyannote', () => {
  it('assigns speakers based on time overlap', () => {
    const pyannote = [
      { speaker: 'SPEAKER_00', start: 0, end: 5 },
      { speaker: 'SPEAKER_01', start: 5, end: 10 },
    ];
    const whisper = [
      { text: 'Hello', start: 1, end: 2 },
      { text: 'Hi', start: 6, end: 7 },
    ];

    const result = mergeWithPyannote(pyannote, whisper);
    expect(result.segments[0].speakerId).toBe(0); // SPEAKER_00
    expect(result.segments[1].speakerId).toBe(1); // SPEAKER_01
  });

  it('handles segments with no overlap', () => {
    const pyannote = [{ speaker: 'SPEAKER_00', start: 10, end: 15 }];
    const whisper = [{ text: 'Hello', start: 0, end: 1 }];

    const result = mergeWithPyannote(pyannote, whisper);
    expect(result.segments[0].speakerId).toBe(0); // Default speaker
  });

  it('maintains consistent speaker IDs', () => {
    const pyannote = [
      { speaker: 'SPEAKER_00', start: 0, end: 5 },
      { speaker: 'SPEAKER_01', start: 5, end: 10 },
      { speaker: 'SPEAKER_00', start: 10, end: 15 },
    ];
    const whisper = [
      { text: 'First', start: 1, end: 2 },
      { text: 'Second', start: 6, end: 7 },
      { text: 'Third', start: 11, end: 12 },
    ];

    const result = mergeWithPyannote(pyannote, whisper);
    expect(result.segments[0].speakerId).toBe(result.segments[2].speakerId);
  });
});
```

---

### 🔹 Główna funkcja `transcribeRecording()` - **4 dni**

#### 9. Scenariusze testowe
```typescript
// server/tests/audioPipeline/transcribeRecording.test.ts
describe('transcribeRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOICELOG_OPENAI_API_KEY = 'test-key';
  });

  it('transcribes small audio file directly', async () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 * 1024 } as any); // 1MB
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('audio'));
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        text: 'Hello world',
        segments: [{ text: 'Hello', start: 0, end: 1 }],
      })),
    });

    const result = await transcribeRecording({
      id: 'rec1',
      file_path: '/tmp/audio.wav',
      content_type: 'audio/wav',
    });

    expect(result.pipelineStatus).toBe('completed');
    expect(result.segments).toHaveLength(1);
  });

  it('chunks large audio files', async () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 30 * 1024 * 1024 } as any); // 30MB
    
    const mockSpawn = vi.spyOn(childProcess, 'spawn');
    mockSpawn.mockImplementation(() => {
      const child = new EventEmitter() as any;
      child.stdout = new EventEmitter();
      child.stdout.setEncoding = vi.fn();
      setTimeout(() => {
        child.stdout.emit('data', Buffer.alloc(100));
        child.emit('close', 0);
      }, 10);
      return child;
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ text: 'Chunk 1' })),
    });

    await transcribeRecording({
      id: 'rec_large',
      file_path: '/tmp/large.wav',
      content_type: 'audio/wav',
    });

    expect(mockSpawn).toHaveBeenCalled(); // ffmpeg was called for chunking
  });

  it('handles empty STT output', async () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('audio'));
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({})),
    });

    const result = await transcribeRecording({
      id: 'rec_empty',
      file_path: '/tmp/audio.wav',
      content_type: 'audio/wav',
    });

    expect(result.transcriptOutcome).toBe('empty');
    expect(result.emptyReason).toBe('no_segments_from_stt');
  });

  it('handles STT API errors', async () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('audio'));
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        error: { message: 'API error' },
      })),
    });

    await expect(transcribeRecording({
      id: 'rec_error',
      file_path: '/tmp/audio.wav',
      content_type: 'audio/wav',
    })).rejects.toThrow('Transkrypcja STT nie powiodla sie');
  });

  it('filters out hallucinated segments', async () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('audio'));
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        text: 'Thank you. Normalne zdanie. Dziękuję.',
        segments: [
          { text: 'Thank you.', start: 0, end: 1 },
          { text: 'Normalne zdanie.', start: 1, end: 3 },
          { text: 'Dziękuję.', start: 3, end: 4 },
        ],
      })),
    });

    const result = await transcribeRecording({
      id: 'rec_hallucination',
      file_path: '/tmp/audio.wav',
      content_type: 'audio/wav',
    });

    // Hallucination segments should be filtered out
    expect(result.segments.some(s => s.text === 'Thank you.')).toBe(false);
    expect(result.segments.some(s => s.text === 'Normalne zdanie.')).toBe(true);
  });

  it('applies VAD when enabled', async () => {
    process.env.VAD_ENABLED = 'true';
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as any);
    
    const mockSpawn = vi.spyOn(childProcess, 'spawn');
    mockSpawn.mockImplementation((cmd, args) => {
      const child = new EventEmitter() as any;
      child.stdout = new EventEmitter();
      child.stdout.setEncoding = vi.fn();
      
      if (String(cmd).includes('vad.py')) {
        setTimeout(() => {
          child.stdout.emit('data', '[]'); // No speech detected
          child.emit('close', 0);
        }, 10);
      }
      return child;
    });

    const result = await transcribeRecording({
      id: 'rec_vad',
      file_path: '/tmp/audio.wav',
      content_type: 'audio/wav',
    });

    expect(result.transcriptionDiagnostics.chunksFlaggedSilentByVad).toBeGreaterThan(0);
  });

  it('generates voice coaching for speakers', async () => {
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('audio'));
    vi.spyOn(childProcess, 'exec').mockImplementation((cmd, opts, cb) => {
      cb(null, '', '');
    });
    
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          text: 'Hello',
          segments: [{ text: 'Hello', start: 0, end: 1, speaker: 0 }],
        })),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Good diction' } }],
        }),
      });

    const result = await transcribeRecording({
      id: 'rec_coaching',
      file_path: '/tmp/audio.wav',
      content_type: 'audio/wav',
    });

    expect(result.speakerFeedback).toBeDefined();
  });
});
```

---

## 🎯 PRIORYTET 2: `TranscriptionService.ts` (68% → 85%)

### Testy do dodania - **1 dzień

```typescript
// server/tests/services/TranscriptionService.additional.test.ts
describe('TranscriptionService', () => {
  describe('analyzeAudioQuality', () => {
    it('returns quality assessment for audio', async () => {
      const service = new TranscriptionService(mockDb, mockPipeline);
      const result = await service.analyzeAudioQuality('rec1', Buffer.from('audio'));
      expect(result).toHaveProperty('qualityLabel');
      expect(result).toHaveProperty('enhancementRecommended');
    });

    it('handles null pipeline response', async () => {
      const service = new TranscriptionService(mockDb, null);
      const result = await service.analyzeAudioQuality('rec1', Buffer.from('audio'));
      expect(result).toBeNull();
    });
  });

  describe('createVoiceProfileFromSpeaker', () => {
    it('extracts speaker audio and creates profile', async () => {
      const service = new TranscriptionService(mockDb, mockPipeline);
      const result = await service.createVoiceProfileFromSpeaker(
        'rec1',
        'speaker_0',
        'Test Profile'
      );
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name', 'Test Profile');
    });

    it('cleans up temporary audio files', async () => {
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync');
      const service = new TranscriptionService(mockDb, mockPipeline);
      await service.createVoiceProfileFromSpeaker('rec1', 'speaker_0', 'Test');
      expect(unlinkSync).toHaveBeenCalled();
    });
  });
});
```

---

## 🎯 PRIORYTET 3: `database.ts` (56% → 80%)

### Testy do dodania - **1 dzień

```typescript
// server/tests/database/database.additional.test.ts
describe('Database', () => {
  describe('upsertMediaAsset', () => {
    it('inserts new media asset', async () => {
      const asset = await db.upsertMediaAsset({
        id: 'rec1',
        workspace_id: 'ws1',
        size_bytes: 1024,
        file_path: '/tmp/audio.wav',
        content_type: 'audio/wav',
      });
      expect(asset.id).toBe('rec1');
    });

    it('updates existing media asset', async () => {
      await db.upsertMediaAsset({ id: 'rec1', workspace_id: 'ws1', size_bytes: 1024 });
      const updated = await db.upsertMediaAsset({ id: 'rec1', size_bytes: 2048 });
      expect(updated.size_bytes).toBe(2048);
    });
  });

  describe('getRecordingWithTranscript', () => {
    it('returns recording with transcript segments', async () => {
      const recording = await db.getRecordingWithTranscript('rec1');
      expect(recording).toHaveProperty('transcript_json');
    });

    it('returns null for non-existent recording', async () => {
      const recording = await db.getRecordingWithTranscript('nonexistent');
      expect(recording).toBeNull();
    });
  });
});
```

---

## 📅 Harmonogram prac

| Tydzień | Zadanie | Oczekiwany coverage |
|---------|---------|---------------------|
| **1** | `audioPipeline.ts` - funkcje czyste | 22% → 45% |
| **2** | `audioPipeline.ts` - funkcje z zależnościami | 45% → 65% |
| **3** | `audioPipeline.ts` - `transcribeRecording()` | 65% → 80% |
| **4** | `TranscriptionService.ts` + `database.ts` | 68% → 85% |
| **5** | `sqliteWorker.ts` + `supabaseStorage.ts` | 0% → 70% |
| **6** | `logger.ts` + `index.ts` + cleanup | 46% → 80% |

---

## 📊 Docelowy coverage

| Plik | Obecnie | Cel |
|------|---------|-----|
| `audioPipeline.ts` | 22% | 80% |
| `TranscriptionService.ts` | 68% | 85% |
| `database.ts` | 56% | 80% |
| `speakerEmbedder.ts` | 68% | 80% |
| `sqliteWorker.ts` | 0% | 70% |
| `supabaseStorage.ts` | 26% | 70% |
| `logger.ts` | 46% | 70% |
| `index.ts` | 61% | 80% |

**Średni coverage servera:** 47% → **78%**

---

## 🧰 Narzędzia

```bash
# Uruchom testy dla konkretnego pliku
npm run test:server -- audioPipeline

# Generuj coverage dla konkretnego testu
npm run test:coverage:server -- --testNamePattern="buildWhisperPrompt"

# Sprawdź coverage w terminalu
npm run coverage:summary

# Otwórz raport HTML
npm run coverage:open
```
