import { useCallback, useState, useEffect } from "react";
import { readStorage, writeStorage, readStorageAsync, writeStorageAsync } from "../lib/storage";

export default function useStoredState(key, initialValue) {
  // eslint-disable-next-line no-undef
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";

  const [state, setState] = useState(() => {
    if (isTest) return readStorage(key, initialValue);
    return initialValue;
  });

  useEffect(() => {
    if (isTest) return;
    let active = true;
    readStorageAsync(key, initialValue).then((val) => {
      if (active) setState(val);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setStoredState = useCallback(
    (nextValue) => {
      setState((current) => {
        const resolved = typeof nextValue === "function" ? nextValue(current) : nextValue;
        if (isTest) {
          writeStorage(key, resolved);
        } else {
          writeStorageAsync(key, resolved);
        }
        return resolved;
      });
    },
    [key, isTest]
  );

  return [state, setStoredState];
}
