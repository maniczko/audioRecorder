import { useCallback, useState, useEffect } from "react";
import { readStorageAsync, writeStorageAsync } from "../lib/storage";

export default function useStoredState(key, initialValue) {
  const [state, setState] = useState(initialValue);

  useEffect(() => {
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
        writeStorageAsync(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  return [state, setStoredState];
}
