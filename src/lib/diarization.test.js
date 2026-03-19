import { summarizeSpectrum, signatureAroundTimestamp, diarizeSegments, verifyRecognizedSegments } from "./diarization";

describe("diarization", () => {
  test("summarizeSpectrum calculates fields correctly", () => {
    const data = new Uint8Array([50, 100, 150, 200, 250, 120]);
    const summary = summarizeSpectrum(data);
    expect(summary).toBeDefined();
    expect(summary.energy).toBeGreaterThan(0);
    expect(summary.centroid).toBeDefined();
    expect(summary.spread).toBeDefined();
    expect(summary.lowBand).toBeDefined();
  });

  test("summarizeSpectrum handles empty data", () => {
    const summary = summarizeSpectrum([]);
    expect(summary).toBeNull();
  });

  test("signatureAroundTimestamp finds correct signature", () => {
    const timeline = [
      { timestamp: 1.0, signature: { energy: 0.1 } },
      { timestamp: 2.0, signature: { energy: 0.2 } },
      { timestamp: 3.0, signature: { energy: 0.3 } },
    ];
    const avg = signatureAroundTimestamp(timeline, 2.0);
    expect(avg.energy).toBeCloseTo(0.15);
  });

  test("diarizeSegments processes empty list", () => {
    const result = diarizeSegments([]);
    expect(result.segments).toEqual([]);
    expect(result.speakerCount).toBe(0);
  });

  test("diarizeSegments processes valid segments", () => {
    const segments = [
      { text: "hello", timestamp: 1, signature: { energy: 0.5, centroid: 0.2, spread: 0.1, lowBand: 0.3, midBand: 0.3, highBand: 0.4 } },
      { text: "world", timestamp: 5, signature: { energy: 0.1, centroid: 0.8, spread: 0.9, lowBand: 0.1, midBand: 0.1, highBand: 0.8 } },
      { text: "!", timestamp: 5.5, signature: null },
      { text: "next", timestamp: 10, signature: null },
    ];
    const result = diarizeSegments(segments);
    expect(result.speakerCount).toBeGreaterThan(0);
    expect(result.segments.length).toBe(4);
    expect(result.confidence).toBeGreaterThan(0);
  });

  test("verifyRecognizedSegments assigns scores and statuses", () => {
    const segments = [
      { text: "", rawConfidence: 0.9, timestamp: 1 },
      { text: "e", rawConfidence: 0.5, timestamp: 2 },
      { text: "yyy", rawConfidence: 0.8, timestamp: 3 },
      { text: "tak tak tak tak", rawConfidence: 0.9, timestamp: 4 },
      { text: "valid text valid text", rawConfidence: 0.9, timestamp: 5, signature: { energy: 0.01 } },
      { text: "valid text valid text", rawConfidence: 0.9, timestamp: 6 },
    ];
    const result = verifyRecognizedSegments(segments);
    expect(result[0].verificationScore).toBeLessThan(0.7);
    expect(result[1].verificationScore).toBeLessThan(0.7);
    expect(result[2].verificationScore).toBeLessThan(0.7);
    expect(result[3].verificationScore).toBeLessThan(0.7);
  });
});
