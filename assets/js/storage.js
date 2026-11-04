/**
 * Tiny JSON wrapper around localStorage.
 *
 * The backend is injectable so tests (and private-mode browsers where
 * localStorage throws on access) can fall back to an in-memory map.
 */

export const STORAGE_PREFIX = 'focusflow:';

/**
 * @typedef {object} Store
 * @property {(key: string, fallback?: any) => any} get
 * @property {(key: string, value: unknown) => boolean} set
 * @property {(key: string) => void} remove
 */

/**
 * @param {Storage | null} [storage]
 * @returns {Store}
 */
export function createStore(storage) {
  /** @type {Storage | null} */
  let backend = null;

  try {
    backend = storage ?? globalThis.localStorage ?? null;
  } catch {
    backend = null;
  }

  const memory = new Map();

  return {
    get(key, fallback = null) {
      try {
        const raw = backend ? backend.getItem(STORAGE_PREFIX + key) : memory.get(STORAGE_PREFIX + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },

    set(key, value) {
      try {
        const raw = JSON.stringify(value);
        if (backend) backend.setItem(STORAGE_PREFIX + key, raw);
        else memory.set(STORAGE_PREFIX + key, raw);
        return true;
      } catch {
        // Quota exceeded or storage disabled: the app keeps working in memory.
        return false;
      }
    },

    remove(key) {
      try {
        if (backend) backend.removeItem(STORAGE_PREFIX + key);
        else memory.delete(STORAGE_PREFIX + key);
      } catch {
        // Nothing sensible to do here.
      }
    },
  };
}
