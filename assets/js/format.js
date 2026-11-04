/**
 * Small, dependency-free formatting helpers shared by the UI and the tests.
 */

export const MINUTE_MS = 60_000;

/**
 * Format a duration as a countdown clock (mm:ss). Partial seconds round up so
 * the display reads 25:00 at the start of a session and 00:01 until it ends.
 *
 * @param {number} ms remaining milliseconds
 * @returns {string} e.g. "24:59"
 */
export function formatClock(ms) {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format a duration in a compact, human way: "45m", "1h", "2h 15m".
 *
 * @param {number} ms milliseconds
 * @returns {string}
 */
export function formatMinutes(ms) {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalMinutes = Math.round(safe / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

/**
 * Local calendar day key (YYYY-MM-DD). Uses local time on purpose: "today"
 * should follow the user's clock, not UTC.
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function dayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Constrain a number to the inclusive [min, max] range.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
