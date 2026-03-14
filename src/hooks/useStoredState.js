import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "../lib/storage";

export default function useStoredState(key, initialValue) {
  const [state, setState] = useState(() => readStorage(key, initialValue));

  useEffect(() => {
    writeStorage(key, state);
  }, [key, state]);

  return [state, setState];
}
