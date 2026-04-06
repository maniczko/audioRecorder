import { useEffect, useState } from 'react';

/**
 * Formats milliseconds into a human-readable duration string (Polish).
 * Examples: "54 sekundy", "2 minuty 15 sekund", "1 godzina 3 minuty"
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} godzina ${minutes} minut`;
  }
  if (minutes > 0) {
    return `${minutes} minut${minutes === 1 ? 'a' : minutes < 5 ? 'y' : ''} ${seconds} sekund`;
  }
  return `${seconds} sekund`;
}

interface ProcessingTimerProps {
  /** ISO timestamp when processing started */
  startedAt: string;
  /** If true, shows "Upłynęło X" prefix; if false, shows just the duration */
  prefix?: boolean;
  /** Optional className for the wrapper */
  className?: string;
}

/**
 * Displays elapsed processing time with a live-updating timer.
 * Updates every second while mounted.
 */
export function ProcessingTimer({
  startedAt,
  prefix = true,
  className = '',
}: ProcessingTimerProps) {
  const [elapsed, setElapsed] = useState<number>(() => {
    const start = new Date(startedAt).getTime();
    return Math.max(0, Date.now() - start);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const start = new Date(startedAt).getTime();
      setElapsed(Math.max(0, Date.now() - start));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const text = prefix ? `Upłynęło ${formatDuration(elapsed)}` : formatDuration(elapsed);

  return <span className={className}>{text}</span>;
}

export { formatDuration };
