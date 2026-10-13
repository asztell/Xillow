/**
 * Thin, failure-tolerant wrapper around `localStorage`.
 *
 * Storage can throw (private mode, disabled cookies, quota) and is not always
 * present. Callers only ever need "read a string or get null" and "write
 * best-effort", so the try/catch lives here instead of being duplicated in each
 * component.
 */

/** Reads a stored string, or `null` when absent or storage is unavailable. */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a string best-effort; storage failures are ignored. */
export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / storage disabled - the value still applies for the session.
  }
}
