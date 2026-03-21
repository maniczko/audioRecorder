import { createContext, useContext } from "react";
import useMeetings from "../hooks/useMeetings";

const MeetingsContext = createContext<any>(null);

export function MeetingsProvider({ children }) {
  const meetings = useMeetings();

  return (
    <MeetingsContext.Provider value={{ meetings }}>
      {children}
    </MeetingsContext.Provider>
  );
}

export function useMeetingsCtx() {
  const ctx = useContext(MeetingsContext);
  if (!ctx) {
    throw new Error("useMeetingsCtx must be used within MeetingsProvider");
  }
  return ctx;
}
