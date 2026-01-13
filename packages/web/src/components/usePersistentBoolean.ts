import { useEffect, useState } from 'react';

const readStoredBoolean = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) {
      return fallback;
    }
    return stored === 'true';
  } catch {
    return fallback;
  }
};

export function usePersistentBoolean(key: string, fallback: boolean) {
  const [value, setValue] = useState<boolean>(() => readStoredBoolean(key, fallback));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // ignore write errors (private mode, disabled storage)
    }
  }, [key, value]);

  return [value, setValue] as const;
}
