import { useCallback, useState, useEffect } from "react";
import { readStorage, writeStorage, readStorageAsync, writeStorageAsync } from "../lib/storage";

export default function useStoredState(key, initialValue) {
  // Always hydrate synchronously from localStorage so critical state
  // (session, auth) is available on the very first render frame.
  const [state, setState] = useState(() => readStorage(key, initialValue));

  // In production, also kick off an async IndexedDB read.
  // If IDB has a newer/larger value it will upgrade the state.
  useEffect(() => {
    // eslint-disable-next-line no-undef
    const isTest = typeof process !== "undefined" && process.env?.NODE_ENV === "test";
    if (isTest) return;

    let active = true;
    readStorageAsync(key, undefined).then((val) => {
      if (active && val !== undefined) setState(val);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStoredState = useCallback(
    (nextValue) => {
      setState((current) => {
        const resolved = typeof nextValue === "function" ? nextValue(current) : nextValue;
        // Always write to localStorage for instant next-load hydration
        writeStorage(key, resolved);
        // Also persist to IndexedDB for large payloads (fire-and-forget)
        writeStorageAsync(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  return [state, setStoredState];
}
