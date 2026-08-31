/**
 * Namespaced browser storage.
 *
 * Mockups are served many-per-origin under /<mockup_id>/ and storage is origin-scoped,
 * not path-scoped, so every key is prefixed with the first URL path segment. Never read
 * or write a bare `token` / `user` / `isAuthenticated` key.
 */
const NS = (typeof location !== 'undefined' && location.pathname.split('/')[1]) || 'app';

export const nsKey = (key: string): string => `${NS}:${key}`;

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(nsKey(key));
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(nsKey(key), value);
  } catch {
    /* storage unavailable (private mode / disabled) — the mockup still works */
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(nsKey(key));
  } catch {
    /* no-op */
  }
}

export function readJson<T>(key: string, isValid: (value: unknown) => boolean): T | null {
  const raw = readStorage(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) {
      removeStorage(key);
      return null;
    }
    return parsed as T;
  } catch {
    removeStorage(key);
    return null;
  }
}
