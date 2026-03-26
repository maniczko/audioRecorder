import { useEffect } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface HotkeyConfig {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: KeyHandler;
}

export function useHotkeys(configs: HotkeyConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger hotkeys if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      for (const config of configs) {
        const keyMatch =
          event.key.toLowerCase() === config.key.toLowerCase() || event.code === config.key;
        const ctrlMatch = !!config.ctrlKey === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!config.shiftKey === event.shiftKey;
        const altMatch = !!config.altKey === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          event.stopPropagation();
          config.handler(event);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [configs]);
}
