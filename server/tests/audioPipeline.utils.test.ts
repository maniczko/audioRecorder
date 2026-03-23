/**
 * Testy dla audioPipeline.utils.ts
 * Coverage target: 90%+
 */

import { describe, it, expect } from "vitest";
import * as utils from "../audioPipeline.utils";

describe("audioPipeline.utils", () => {
  // ==================== CONSTANTS ====================
  
  describe("Constants", () => {
    it("exports HALLUCINATION_PATTERNS array", () => {
      expect(utils.HALLUCINATION_PATTERNS).toBeInstanceOf(Array);
      expect(utils.HALLUCINATION_PATTERNS.length).toBeGreaterThanOrEqual(10);
    });

    it("exports DEFAULT_WHISPER_PROMPT", () => {
      expect(utils.DEFAULT_WHISPER_PROMPT).toContain("język polski");
      expect(utils.DEFAULT_WHISPER_PROMPT).toContain("spotkanie");
    });

    it("exports VERIFY_CONFIDENCE_THRESHOLD", () => {
      expect(utils.VERIFY_CONFIDENCE_THRESHOLD).toBe(0.52);
    });

    it("exports VERIFY_SCORE_THRESHOLD", () => {
      expect(utils.VERIFY_SCORE_THRESHOLD).toBe(0.65);
    });

    it("exports CHUNK_DURATION_SECONDS", () => {
      expect(utils.CHUNK_DURATION_SECONDS).toBe(540);
    });

    it("exports MAX_FILE_SIZE_BYTES", () => {
      expect(utils.MAX_FILE_SIZE_BYTES).toBe(24 * 1024 * 1024);
    });
  });

  // ==================== TEXT UTILITIES ====================

  describe("clean()", () => {
    it("trims whitespace", () => {
      expect(utils.clean("  hello  ")).toBe("hello");
    });

    it("handles null/undefined", () => {
      expect(utils.clean(null)).toBe("");
      expect(utils.clean(undefined)).toBe("");
    });

    it("converts to string", () => {
      expect(utils.clean(123)).toBe("123");
      expect(utils.clean(true)).toBe("true");
    });
  });

  describe("normalizeText()", () => {
    it("converts to lowercase", () => {
      expect(utils.normalizeText("HELLO")).toBe("hello");
    });

    it("removes punctuation", () => {
      expect(utils.normalizeText("Hello, World!")).toBe("hello world");
    });

    it("normalizes whitespace", () => {
      expect(utils.normalizeText("  hello   world  ")).toBe("hello world");
    });

    it("handles Polish characters", () => {
      expect(utils.normalizeText("Cześć! Jak się masz?")).toBe("cześć jak się masz");
    });

    it("handles empty input", () => {
      expect(utils.normalizeText("")).toBe("");
    });
  });

  describe("tokenize()", () => {
    it("splits on whitespace", () => {
      expect(utils.tokenize("hello world foo")).toEqual(["hello", "world", "foo"]);
    });

    it("removes empty tokens", () => {
      expect(utils.tokenize("hello   world")).toEqual(["hello", "world"]);
    });

    it("removes punctuation", () => {
      expect(utils.tokenize("hello, world!")).toEqual(["hello", "world"]);
    });

    it("handles Polish text", () => {
      expect(utils.tokenize("Cześć świecie!")).toEqual(["cześć", "świecie"]);
    });

    it("returns empty array for empty input", () => {
      expect(utils.tokenize("")).toEqual([]);
    });
  });

  describe("textSimilarity()", () => {
    it("returns 1 for identical texts", () => {
      expect(utils.textSimilarity("hello world", "hello world")).toBe(1);
    });

    it("returns 0 for completely different texts", () => {
      expect(utils.textSimilarity("apple", "orange")).toBeLessThan(0.5);
    });

    it("handles partial matches", () => {
      const similarity = utils.textSimilarity("hello world foo", "hello world bar");
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });

    it("is case insensitive", () => {
      expect(utils.textSimilarity("HELLO", "hello")).toBe(1);
    });

    it("ignores punctuation", () => {
      expect(utils.textSimilarity("hello!", "hello")).toBe(1);
      expect(utils.textSimilarity("hello, world", "hello world")).toBe(1);
    });

    it("handles empty strings", () => {
      expect(utils.textSimilarity("", "hello")).toBe(0);
      expect(utils.textSimilarity("hello", "")).toBe(0);
      expect(utils.textSimilarity("", "")).toBe(0);
    });

    it("handles Polish text", () => {
      expect(utils.textSimilarity("cześć jak się masz", "cześć jak się masz")).toBe(1);
    });
  });

  describe("computeWerProxy()", () => {
    it("returns 0 for identical transcripts", () => {
      expect(utils.computeWerProxy("to jest test", "to jest test")).toBe(0);
    });

    it("returns fractional error for partial mismatch", () => {
      const wer = utils.computeWerProxy("to jest bardzo dobry test", "to jest dobry test");
      expect(wer).toBeGreaterThan(0);
      expect(wer).toBeLessThan(1);
    });

    it("returns 1 for completely different short transcripts", () => {
      expect(utils.computeWerProxy("ala ma kota", "pies je obiad")).toBe(1);
    });
  });

  describe("hasRepeatedPhrase()", () => {
    it("detects repeated phrases", () => {
      expect(utils.hasRepeatedPhrase("hello hello hello hello")).toBe(true);
      expect(utils.hasRepeatedPhrase("test test test test test")).toBe(true);
    });

    it("returns false for normal text", () => {
      expect(utils.hasRepeatedPhrase("hello world foo bar")).toBe(false);
      expect(utils.hasRepeatedPhrase("to jest normalne zdanie bez powtórzeń")).toBe(false);
    });

    it("returns false for short text", () => {
      expect(utils.hasRepeatedPhrase("a b c")).toBe(false);
      expect(utils.hasRepeatedPhrase("hello")).toBe(false);
    });
  });

  describe("isHallucination()", () => {
    it("detects English filler phrases", () => {
      expect(utils.isHallucination("Thank you.")).toBe(true);
      expect(utils.isHallucination("Thanks for watching!")).toBe(true);
      expect(utils.isHallucination("Please like and subscribe.")).toBe(true);
    });

    it("detects goodbye phrases", () => {
      expect(utils.isHallucination("Goodbye.")).toBe(true);
      expect(utils.isHallucination("Bye.")).toBe(true);
      expect(utils.isHallucination("See you.")).toBe(true);
    });

    it("detects Polish filler phrases", () => {
      expect(utils.isHallucination("Dziękuję.")).toBe(true);
      expect(utils.isHallucination("Do widzenia.")).toBe(true);
      expect(utils.isHallucination("Na razie.")).toBe(true);
    });

    it("detects Polish short responses", () => {
      expect(utils.isHallucination("Tak.")).toBe(true);
      expect(utils.isHallucination("Nie.")).toBe(true);
      expect(utils.isHallucination("Okej.")).toBe(true);
    });

    it("detects music/non-speech markers", () => {
      expect(utils.isHallucination("[Music]")).toBe(true);
      expect(utils.isHallucination("[Applause]")).toBe(true);
      expect(utils.isHallucination("♪")).toBe(true);
    });

    it("detects punctuation-only text", () => {
      expect(utils.isHallucination("...")).toBe(true);
      expect(utils.isHallucination("!?")).toBe(true);
    });

    it("detects repetition artifacts", () => {
      expect(utils.isHallucination("mmm.")).toBe(true);
      expect(utils.isHallucination("hmmm.")).toBe(true);
      expect(utils.isHallucination("uhhh.")).toBe(true);
    });

    it("returns false for valid speech", () => {
      expect(utils.isHallucination("To jest normalne zdanie.")).toBe(false);
      expect(utils.isHallucination("Spotkanie rozpoczęło się o 10:00.")).toBe(false);
    });

    it("returns true for empty/short text", () => {
      expect(utils.isHallucination("")).toBe(true);
      expect(utils.isHallucination(" ")).toBe(true);
      expect(utils.isHallucination("a")).toBe(true);
    });

    it("handles case insensitivity", () => {
      expect(utils.isHallucination("THANK YOU.")).toBe(true);
      expect(utils.isHallucination("[MUSIC]")).toBe(true);
    });

    it("detects Whisper repetition loops", () => {
      expect(utils.isHallucination("Cześć! Cześć! Cześć! Cześć! Cześć! Cześć! Cześć! Cześć! Cześć! Cześć!")).toBe(true);
      expect(utils.isHallucination("hello hello hello hello")).toBe(true);
      expect(utils.isHallucination("test test test test test")).toBe(true);
    });

    it("does not filter short repeated greetings (≤3 tokens)", () => {
      expect(utils.isHallucination("Cześć! Cześć!")).toBe(false);
    });
  });

  // ==================== MATH UTILITIES ====================

  describe("clamp()", () => {
    it("clamps value within range", () => {
      expect(utils.clamp(5, 0, 10)).toBe(5);
      expect(utils.clamp(-5, 0, 10)).toBe(0);
      expect(utils.clamp(15, 0, 10)).toBe(10);
    });

    it("handles edge cases", () => {
      expect(utils.clamp(0, 0, 10)).toBe(0);
      expect(utils.clamp(10, 0, 10)).toBe(10);
      expect(utils.clamp(5, 5, 5)).toBe(5);
    });
  });

  describe("average()", () => {
    it("calculates average of values", () => {
      expect(utils.average([1, 2, 3, 4, 5])).toBe(3);
      expect(utils.average([10, 20, 30])).toBe(20);
    });

    it("returns 0 for empty array", () => {
      expect(utils.average([])).toBe(0);
    });

    it("handles single value", () => {
      expect(utils.average([42])).toBe(42);
    });

    it("handles negative values", () => {
      expect(utils.average([-1, -2, -3])).toBe(-2);
    });

    it("handles decimal values", () => {
      expect(utils.average([0.1, 0.2, 0.3])).toBeCloseTo(0.2, 5);
    });
  });

  describe("parseDbNumber()", () => {
    it("parses numbers from strings", () => {
      expect(utils.parseDbNumber("123")).toBe(123);
      expect(utils.parseDbNumber("-45.67")).toBe(-45.67);
      expect(utils.parseDbNumber("0")).toBe(0);
    });

    it("extracts numbers from text", () => {
      expect(utils.parseDbNumber("value: 42")).toBe(42);
      expect(utils.parseDbNumber("temp -5.5 degrees")).toBe(-5.5);
    });

    it("returns fallback for invalid input", () => {
      expect(utils.parseDbNumber(null)).toBe(0);
      expect(utils.parseDbNumber("")).toBe(0);
      expect(utils.parseDbNumber("abc")).toBe(0);
      expect(utils.parseDbNumber("abc", 10)).toBe(10);
    });
  });

  // ==================== SEGMENT UTILITIES ====================

  describe("mergeShortSegments()", () => {
    it("returns single segment unchanged", () => {
      const segments = [
        { text: "Hello", timestamp: 0, endTimestamp: 5, speakerId: 0 },
      ];
      expect(utils.mergeShortSegments(segments)).toEqual(segments);
    });

    it("merges consecutive short segments from same speaker", () => {
      const segments = [
        { text: "Hello", timestamp: 0, endTimestamp: 0.5, speakerId: 0 },
        { text: "world", timestamp: 0.6, endTimestamp: 1, speakerId: 0 },
      ];
      const result = utils.mergeShortSegments(segments, 1.2);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Hello world");
      expect(result[0].endTimestamp).toBe(1);
    });

    it("does not merge segments from different speakers", () => {
      const segments = [
        { text: "Hello", timestamp: 0, endTimestamp: 0.5, speakerId: 0 },
        { text: "Hi", timestamp: 0.6, endTimestamp: 1, speakerId: 1 },
      ];
      const result = utils.mergeShortSegments(segments, 1.2);
      expect(result).toHaveLength(2);
    });

    it("does not merge long segments", () => {
      const segments = [
        { text: "Hello", timestamp: 0, endTimestamp: 2, speakerId: 0 },
        { text: "world", timestamp: 2.1, endTimestamp: 4, speakerId: 0 },
      ];
      const result = utils.mergeShortSegments(segments, 1.2);
      expect(result).toHaveLength(2);
    });

    it("preserves verification status (review takes precedence)", () => {
      const segments = [
        { 
          text: "Hello", 
          timestamp: 0, 
          endTimestamp: 0.5, 
          speakerId: 0,
          verificationStatus: "review",
          verificationScore: 0.4,
        },
        { 
          text: "world", 
          timestamp: 0.6, 
          endTimestamp: 1, 
          speakerId: 0,
          verificationStatus: "verified",
          verificationScore: 0.8,
        },
      ];
      const result = utils.mergeShortSegments(segments, 1.2);
      expect(result[0].verificationStatus).toBe("review");
      expect(result[0].verificationScore).toBe(0.4);
    });

    it("handles empty segments array", () => {
      expect(utils.mergeShortSegments([], 1.2)).toEqual([]);
    });
  });

  describe("estimateQualityScore()", () => {
    it("returns high score for good text", () => {
      const score = utils.estimateQualityScore("To jest dobrej jakości tekst.");
      expect(score).toBeGreaterThan(0.5);
    });

    it("returns low score for empty text", () => {
      expect(utils.estimateQualityScore("")).toBe(0.15);
    });

    it("returns low score for very short text", () => {
      const score = utils.estimateQualityScore("abc");
      expect(score).toBeLessThan(0.7);
    });

    it("penalizes hmm/yyy patterns", () => {
      const score = utils.estimateQualityScore("hmmmm");
      expect(score).toBeLessThan(0.7);
    });

    it("penalizes repeated phrases", () => {
      const score = utils.estimateQualityScore("test test test test test test");
      expect(score).toBeLessThanOrEqual(0.7);
    });

    it("penalizes multiple question marks", () => {
      const score = utils.estimateQualityScore("Co???");
      expect(score).toBeLessThan(0.75);
    });
  });

  describe("parseJsonResponse()", () => {
    it("parses valid JSON", () => {
      expect(utils.parseJsonResponse('{"key": "value"}')).toEqual({ key: "value" });
    });

    it("returns empty object for invalid JSON", () => {
      expect(utils.parseJsonResponse("not json")).toEqual({});
      expect(utils.parseJsonResponse("{invalid}")).toEqual({});
    });

    it("returns empty object for null/undefined/empty", () => {
      expect(utils.parseJsonResponse(null)).toEqual({});
      expect(utils.parseJsonResponse(undefined)).toEqual({});
      expect(utils.parseJsonResponse("")).toEqual({});
    });
  });

  // ==================== DIARIZATION UTILITIES ====================

  describe("normalizeSpeakerLabel()", () => {
    it("returns Speaker N for generic labels", () => {
      expect(utils.normalizeSpeakerLabel("A", 0)).toBe("Speaker 1");
      expect(utils.normalizeSpeakerLabel("speaker_0", 0)).toBe("Speaker 1");
      expect(utils.normalizeSpeakerLabel("SPEAKER_1", 1)).toBe("Speaker 2");
    });

    it("preserves custom speaker names", () => {
      expect(utils.normalizeSpeakerLabel("Anna", 0)).toBe("Anna");
      expect(utils.normalizeSpeakerLabel("Jan Kowalski", 1)).toBe("Jan Kowalski");
    });

    it("handles empty labels", () => {
      expect(utils.normalizeSpeakerLabel("", 0)).toBe("Speaker 1");
      expect(utils.normalizeSpeakerLabel(null as any, 0)).toBe("Speaker 1");
    });
  });

  describe("getRawWords()", () => {
    it("extracts words from payload.words", () => {
      const payload = { words: [{ word: "hello" }] };
      expect(utils.getRawWords(payload)).toEqual([{ word: "hello" }]);
    });

    it("extracts words from payload.transcript.words", () => {
      const payload = { transcript: { words: [{ text: "hello" }] } };
      expect(utils.getRawWords(payload)).toEqual([{ text: "hello" }]);
    });

    it("extracts words from payload.results.words", () => {
      const payload = { results: { words: [{ content: "hello" }] } };
      expect(utils.getRawWords(payload)).toEqual([{ content: "hello" }]);
    });

    it("returns empty array for unknown format", () => {
      expect(utils.getRawWords({})).toEqual([]);
      expect(utils.getRawWords(null)).toEqual([]);
    });
  });

  describe("synthesizeSegmentsFromWords()", () => {
    it("creates segments from words", () => {
      const payload = {
        words: [
          { word: "Hello", start: 0, end: 0.5 },
          { word: "world", start: 0.6, end: 1 },
        ],
      };
      const result = utils.synthesizeSegmentsFromWords(payload);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].text).toBe("Hello world");
    });

    it("splits segments on punctuation", () => {
      const payload = {
        words: [
          { word: "Hello.", start: 0, end: 0.5 },
          { word: "World.", start: 1, end: 1.5 },
        ],
      };
      const result = utils.synthesizeSegmentsFromWords(payload);
      expect(result.segments).toHaveLength(2);
    });

    it("handles empty payload", () => {
      const result = utils.synthesizeSegmentsFromWords({});
      expect(result.segments).toEqual([]);
      expect(result.text).toBe("");
    });

    it("handles payload with only text", () => {
      const payload = { text: "Hello world" };
      const result = utils.synthesizeSegmentsFromWords(payload);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].text).toBe("Hello world");
    });
  });

  describe("normalizeDiarizedSegments()", () => {
    it("normalizes segments with speaker info", () => {
      const payload = {
        segments: [
          { text: "Hello", speaker: "SPEAKER_00", start: 0, end: 1 },
          { text: "World", speaker: "SPEAKER_01", start: 2, end: 3 },
        ],
      };
      const result = utils.normalizeDiarizedSegments(payload);
      expect(result.segments).toHaveLength(2);
      expect(result.speakerCount).toBe(2);
    });

    it("synthesizes segments from words if no segments", () => {
      const payload = {
        words: [
          { word: "Hello", start: 0, end: 1 },
        ],
      };
      const result = utils.normalizeDiarizedSegments(payload);
      expect(result.segments).toHaveLength(1);
    });

    it("handles empty payload", () => {
      const result = utils.normalizeDiarizedSegments({});
      expect(result.segments).toEqual([]);
      expect(result.speakerCount).toBe(0);
    });
  });

  describe("normalizeVerificationSegments()", () => {
    it("normalizes verification segments", () => {
      const payload = {
        segments: [
          { text: "Hello", start: 0, end: 1, avg_logprob: -0.5, no_speech_prob: 0.1 },
        ],
      };
      const result = utils.normalizeVerificationSegments(payload);
      expect(result).toHaveLength(1);
      expect(result[0].avgLogprob).toBe(-0.5);
      expect(result[0].noSpeechProb).toBe(0.1);
    });

    it("synthesizes from words if no segments", () => {
      const payload = {
        words: [{ word: "Hello", start: 0, end: 1 }],
      };
      const result = utils.normalizeVerificationSegments(payload);
      expect(result).toHaveLength(1);
    });
  });

  describe("overlapSeconds()", () => {
    it("calculates overlap for overlapping segments", () => {
      const left = { timestamp: 0, endTimestamp: 5 };
      const right = { start: 3, end: 7 };
      expect(utils.overlapSeconds(left, right)).toBe(2);
    });

    it("returns 0 for non-overlapping segments", () => {
      const left = { timestamp: 0, endTimestamp: 5 };
      const right = { start: 6, end: 10 };
      expect(utils.overlapSeconds(left, right)).toBe(0);
    });

    it("handles exact boundary", () => {
      const left = { timestamp: 0, endTimestamp: 5 };
      const right = { start: 5, end: 10 };
      expect(utils.overlapSeconds(left, right)).toBe(0);
    });
  });

  describe("evaluateAgainstVerificationPass()", () => {
    it("returns default scores when no overlaps", () => {
      const segment = { text: "Hello", timestamp: 0, endTimestamp: 1 };
      const verificationSegments = [{ text: "World", start: 5, end: 6 }];
      const result = utils.evaluateAgainstVerificationPass(segment, verificationSegments);
      expect(result.whisperConfidence).toBe(0.42);
      expect(result.alignmentScore).toBe(0.34);
    });

    it("calculates scores for overlapping segments", () => {
      const segment = { text: "Hello world", timestamp: 0, endTimestamp: 2 };
      const verificationSegments = [
        { text: "Hello world", start: 0, end: 2, avgLogprob: -0.1 },
      ];
      const result = utils.evaluateAgainstVerificationPass(segment, verificationSegments);
      expect(result.alignmentScore).toBe(1);
    });

    it("adds reasons for low confidence", () => {
      const segment = { text: "Hello", timestamp: 0, endTimestamp: 1 };
      const verificationSegments = [
        { text: "Different", start: 0, end: 1, avgLogprob: -2, no_speech_prob: 0.6 },
      ];
      const result = utils.evaluateAgainstVerificationPass(segment, verificationSegments);
      expect(result.reasons).toContain("niska pewnosc ASR w przebiegu weryfikujacym");
      expect(result.reasons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("buildVerificationResult()", () => {
    it("builds verified segments with scores", () => {
      const diarizedSegments = [
        { text: "Hello world test", timestamp: 0, endTimestamp: 2, speakerId: 0 },
      ];
      const verificationSegments = [
        { text: "Hello world test", start: 0, end: 2, avgLogprob: -0.1 },
      ];
      const result = utils.buildVerificationResult(diarizedSegments, verificationSegments);
      expect(result.verifiedSegments).toHaveLength(1);
      expect(result.verifiedSegments[0].verificationStatus).toBe("verified");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("marks segments as review when score is low", () => {
      const diarizedSegments = [
        { text: "x", timestamp: 0, endTimestamp: 0.5, speakerId: 0 },
      ];
      const verificationSegments = [];
      const result = utils.buildVerificationResult(diarizedSegments, verificationSegments);
      expect(result.verifiedSegments[0].verificationStatus).toBe("review");
    });

    it("detects duplicate segments", () => {
      const diarizedSegments = [
        { text: "Hello", timestamp: 0, endTimestamp: 1, speakerId: 0 },
        { text: "Hello", timestamp: 2, endTimestamp: 3, speakerId: 0 },
      ];
      const verificationSegments = [];
      const result = utils.buildVerificationResult(diarizedSegments, verificationSegments);
      expect(result.verifiedSegments[1].verificationReasons).toContain("duplikat poprzedniego fragmentu");
    });
  });

  describe("buildEmptyTranscriptResult()", () => {
    it("builds empty result with reason", () => {
      const result = utils.buildEmptyTranscriptResult("no_segments_from_stt");
      expect(result.transcriptOutcome).toBe("empty");
      expect(result.emptyReason).toBe("no_segments_from_stt");
      expect(result.segments).toEqual([]);
      expect(result.speakerCount).toBe(0);
    });

    it("includes diagnostics and audio quality", () => {
      const diagnostics = { chunksAttempted: 2 };
      const audioQuality = { qualityLabel: "poor" };
      const result = utils.buildEmptyTranscriptResult("no_segments_from_stt", diagnostics, audioQuality);
      expect(result.transcriptionDiagnostics).toEqual(diagnostics);
      expect(result.audioQuality).toEqual(audioQuality);
    });
  });

  // ==================== PROMPT BUILDING ====================

  describe("buildWhisperPrompt()", () => {
    it("returns default prompt when no metadata provided", () => {
      const prompt = utils.buildWhisperPrompt({});
      expect(prompt).toContain("język polski");
      expect(prompt).toContain("spotkanie");
    });

    it("includes meeting title when provided", () => {
      const prompt = utils.buildWhisperPrompt({ meetingTitle: "Sprint Planning" });
      expect(prompt).toContain("Spotkanie: Sprint Planning.");
    });

    it("includes participants (max 8)", () => {
      const participants = ["Anna", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Henry", "Ivan"];
      const prompt = utils.buildWhisperPrompt({ participants });
      expect(prompt).toContain("Uczestnicy:");
      expect(prompt).toContain("Anna");
      expect(prompt).toContain("Henry");
      expect(prompt).not.toContain("Ivan");
    });

    it("includes tags (max 6)", () => {
      const tags = ["budget", "timeline", "resources", "risks", "stakeholders", "deliverables", "extra"];
      const prompt = utils.buildWhisperPrompt({ tags });
      expect(prompt).toContain("Tematy:");
      expect(prompt).toContain("budget");
      expect(prompt).toContain("deliverables");
      expect(prompt).not.toContain("extra");
    });

    it("truncates long meeting title to 80 chars", () => {
      const longTitle = "A".repeat(150);
      const prompt = utils.buildWhisperPrompt({ meetingTitle: longTitle });
      expect(prompt).toContain("Spotkanie: " + "A".repeat(80) + ".");
    });

    it("truncates vocabulary to 200 chars", () => {
      const vocab = "B".repeat(300);
      const prompt = utils.buildWhisperPrompt({ vocabulary: vocab });
      expect(prompt).toContain("B".repeat(200));
    });

    it("handles empty arrays gracefully", () => {
      const prompt = utils.buildWhisperPrompt({
        participants: [],
        tags: [],
      });
      expect(prompt).not.toContain("Uczestnicy:");
      expect(prompt).not.toContain("Tematy:");
    });

    it("handles null/undefined values gracefully", () => {
      expect(() => utils.buildWhisperPrompt(null as any)).not.toThrow();
      expect(() => utils.buildWhisperPrompt(undefined)).not.toThrow();
      expect(() => utils.buildWhisperPrompt({ meetingTitle: null as any })).not.toThrow();
    });

    it("filters out empty participant names", () => {
      const participants = ["Anna", "", "  ", "Bob", null as any, undefined as any];
      const prompt = utils.buildWhisperPrompt({ participants });
      expect(prompt).toContain("Anna");
      expect(prompt).toContain("Bob");
      expect(prompt).not.toContain("Uczestnicy: ,");
    });

    it("filters out empty tags", () => {
      const tags = ["budget", "", "  ", "timeline"];
      const prompt = utils.buildWhisperPrompt({ tags });
      expect(prompt).toContain("budget");
      expect(prompt).toContain("timeline");
    });

    it("combines all metadata fields", () => {
      const prompt = utils.buildWhisperPrompt({
        meetingTitle: "Quarterly Review",
        participants: ["Alice", "Bob"],
        tags: ["Q4", "review"],
        vocabulary: "KPI, OKR, revenue",
      });
      expect(prompt).toContain("język polski");
      expect(prompt).toContain("Spotkanie: Quarterly Review");
      expect(prompt).toContain("Uczestnicy: Alice, Bob");
      expect(prompt).toContain("Tematy: Q4, review");
      expect(prompt).toContain("KPI, OKR, revenue");
    });

    it("respects 900 character limit", () => {
      const prompt = utils.buildWhisperPrompt({
        meetingTitle: "A".repeat(100),
        participants: Array(10).fill("Person"),
        tags: Array(10).fill("tag"),
        vocabulary: "V".repeat(300),
      });
      expect(prompt.length).toBeLessThanOrEqual(900);
    });

    it("uses custom base prompt when provided", () => {
      const customPrompt = "Custom base prompt.";
      const prompt = utils.buildWhisperPrompt({
        basePrompt: customPrompt,
        meetingTitle: "Test",
      });
      expect(prompt).toContain(customPrompt);
    });
  });

  // ==================== HELPERS ====================

  describe("cryptoRandomId()", () => {
    it("generates a random ID", () => {
      const id1 = utils.cryptoRandomId();
      const id2 = utils.cryptoRandomId();
      expect(id1).not.toBe(id2);
    });

    it("generates IDs without dashes", () => {
      const id = utils.cryptoRandomId();
      expect(id).not.toContain("-");
    });

    it("generates IDs of reasonable length", () => {
      const id = utils.cryptoRandomId();
      expect(id.length).toBeGreaterThan(10);
    });
  });

  describe("deriveFfprobeBinary()", () => {
    it("derives ffprobe from ffmpeg", () => {
      expect(utils.deriveFfprobeBinary("ffmpeg")).toBe("ffprobe");
    });

    it("handles ffmpeg.exe", () => {
      expect(utils.deriveFfprobeBinary("ffmpeg.exe")).toBe("ffprobe.exe");
    });

    it("handles full path", () => {
      expect(utils.deriveFfprobeBinary("/usr/bin/ffmpeg")).toBe("/usr/bin/ffprobe");
    });

    it("returns default ffprobe for non-ffmpeg input", () => {
      expect(utils.deriveFfprobeBinary("")).toBe("ffprobe");
      expect(utils.deriveFfprobeBinary(null as any)).toBe("ffprobe");
    });
  });

  // ==================== DIARIZATION UTILITIES ====================

  describe("diarization utilities", () => {
    it("extracts words from different payload formats", () => {
      const { getRawWords } = utils;

      // From words array
      expect(getRawWords({ words: [{ word: "hello" }, { word: "world" }] })).toHaveLength(2);

      // From transcript.words
      expect(getRawWords({ transcript: { words: [{ word: "test" }] } })).toHaveLength(1);

      // From results.words
      expect(getRawWords({ results: { words: [{ word: "a" }, { word: "b" }, { word: "c" }] } })).toHaveLength(3);

      // Empty for unknown format
      expect(getRawWords({ text: "hello" })).toHaveLength(0);
    });
  });
});
