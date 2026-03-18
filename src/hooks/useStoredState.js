import { useCallback, useState } from "react";
import { readStorage, writeStorage } from "../lib/storage";

export default function useStoredState(key, initialValue) {
  const [state, setState] = useState(() => readStorage(key, initialValue));

  const setStoredState = useCallback(
    (nextValue) => {
      setState((current) => {
        const resolved = typeof nextValue === "function" ? nextValue(current) : nextValue;
        writeStorage(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  return [state, setStoredState];
}
