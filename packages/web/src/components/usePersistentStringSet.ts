import { useEffect, useState } from 'react';

const readStoredSet = (key: string) => {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return new Set<string>();
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set<string>(parsed.filter((value) => typeof value === 'string'));
    }
  } catch {
    return new Set<string>();
  }
  return new Set<string>();
};

export function usePersistentStringSet(key: string) {
  const [value, setValue] = useState<Set<string>>(() => readStoredSet(key));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(Array.from(value)));
    } catch {
      // ignore write errors (private mode, disabled storage)
    }
  }, [key, value]);

  return [value, setValue] as const;
}
