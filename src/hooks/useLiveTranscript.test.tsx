import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import useLiveTranscript from "./useLiveTranscript";

describe("useLiveTranscript", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("polls chunks and updates caption when transcription succeeds", async () => {
    const transcribeLive = vi.fn().mockResolvedValue("Nowy podpis");
    const chunksRef = { current: [new Blob(["a".repeat(400)]), new Blob(["b".repeat(400)]), new Blob(["c".repeat(400)])] };

    const { result } = renderHook(() =>
      useLiveTranscript({
        chunksRef,
        isRecording: true,
        enabled: true,
        transcribeLive,
        mimeType: "audio/webm",
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(transcribeLive).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("Nowy podpis");
  });

  test("does not start a second request while previous transcription is inflight", async () => {
    let resolveRequest: ((value: string) => void) | null = null;
    const transcribeLive = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRequest = resolve;
        })
    );
    const chunksRef = { current: [new Blob(["a".repeat(400)]), new Blob(["b".repeat(400)]), new Blob(["c".repeat(400)])] };

    renderHook(() =>
      useLiveTranscript({
        chunksRef,
        isRecording: true,
        enabled: true,
        transcribeLive,
        mimeType: "audio/webm",
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(transcribeLive).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest?.("Podpis po czasie");
      await Promise.resolve();
    });
  });

  test("clears caption on cleanup and when disabled", async () => {
    const transcribeLive = vi.fn().mockResolvedValue("Podpis");
    const chunksRef = { current: [new Blob(["a".repeat(400)]), new Blob(["b".repeat(400)]), new Blob(["c".repeat(400)])] };

    const { result, rerender, unmount } = renderHook(
      ({ isRecording, enabled }) =>
        useLiveTranscript({
          chunksRef,
          isRecording,
          enabled,
          transcribeLive,
          mimeType: "audio/webm",
        }),
      {
        initialProps: { isRecording: true, enabled: true },
      }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current).toBe("Podpis");

    rerender({ isRecording: true, enabled: false });
    expect(result.current).toBe("");

    unmount();
    expect(transcribeLive).toHaveBeenCalledTimes(1);
  });
});
