/**
 * Pomodoro state machine.
 *
 * The timer owns no clock of its own: every method takes a `now` timestamp so
 * the logic stays deterministic and easy to unit test. The UI decides how
 * often to call `tick()`.
 */

import { clamp, MINUTE_MS } from './format.js';

/** @typedef {'focus' | 'short' | 'long'} Mode */

export const MODES = /** @type {const} */ (['focus', 'short', 'long']);

export const MODE_LABELS = {
  focus: 'Focus',
  short: 'Short break',
  long: 'Long break',
};

export const MODE_CAPTIONS = {
  focus: 'Focus session',
  short: 'Short break',
  long: 'Long break',
};

/** A long break lands after every Nth completed focus session. */
export const LONG_BREAK_EVERY = 4;

export const DEFAULT_DURATIONS = {
  focus: 25 * MINUTE_MS,
  short: 5 * MINUTE_MS,
  long: 15 * MINUTE_MS,
};

const MIN_DURATION = MINUTE_MS;
const MAX_DURATION = 180 * MINUTE_MS;

/**
 * @param {Mode} mode
 * @returns {mode is Mode}
 */
export function isMode(mode) {
  return MODES.includes(mode);
}

/**
 * Coerce a possibly-untrusted duration map into sane values.
 *
 * @param {Record<string, unknown>} [durations]
 * @returns {{ focus: number, short: number, long: number }}
 */
export function sanitizeDurations(durations = {}) {
  /** @type {{ focus: number, short: number, long: number }} */
  const result = { ...DEFAULT_DURATIONS };

  for (const mode of MODES) {
    const candidate = Number(durations?.[mode]);
    if (Number.isFinite(candidate)) {
      result[mode] = clamp(candidate, MIN_DURATION, MAX_DURATION);
    }
  }

  return result;
}

export class PomodoroTimer {
  /** @type {number | null} */
  #endAt = null;

  /**
   * @param {object} [options]
   * @param {Partial<Record<Mode, number>>} [options.durations]
   * @param {Mode} [options.mode]
   * @param {number} [options.completedFocus]
   * @param {number} [options.remainingMs]
   */
  constructor({ durations = {}, mode = 'focus', completedFocus = 0, remainingMs } = {}) {
    this.durations = sanitizeDurations(durations);
    this.mode = isMode(mode) ? mode : 'focus';
    this.completedFocus = Number.isInteger(completedFocus) && completedFocus > 0 ? completedFocus : 0;
    this.remainingMs = Number.isFinite(remainingMs)
      ? clamp(Number(remainingMs), 0, this.durations[this.mode])
      : this.durations[this.mode];
    this.running = false;
  }

  /** Full length of the current mode, in milliseconds. */
  get durationMs() {
    return this.durations[this.mode];
  }

  /** Fraction of the session still left, from 1 down to 0. */
  get progress() {
    if (this.durationMs <= 0) return 0;
    return clamp(this.remainingMs / this.durationMs, 0, 1);
  }

  /** Milliseconds spent in the current session. */
  get elapsedMs() {
    return Math.max(0, this.durationMs - this.remainingMs);
  }

  /**
   * Start (or resume) the countdown.
   * @param {number} now
   * @returns {boolean} whether the timer actually started
   */
  start(now) {
    if (this.running || this.remainingMs <= 0) return false;
    this.#endAt = now + this.remainingMs;
    this.running = true;
    return true;
  }

  /**
   * Freeze the countdown, keeping whatever time is left.
   * @param {number} now
   * @returns {boolean} whether the timer was running
   */
  pause(now) {
    if (!this.running) return false;
    this.remainingMs = Math.max(0, /** @type {number} */ (this.#endAt) - now);
    this.running = false;
    this.#endAt = null;
    return true;
  }

  /**
   * Advance the clock. Safe to call at any rate; it is anchored to wall time.
   *
   * @param {number} now
   * @returns {{ mode: Mode, finished: true } | null} event when the session ends
   */
  tick(now) {
    if (!this.running) return null;

    this.remainingMs = Math.max(0, /** @type {number} */ (this.#endAt) - now);
    if (this.remainingMs > 0) return null;

    this.running = false;
    this.#endAt = null;
    return { mode: this.mode, finished: true };
  }

  /** Restore the current mode to its full duration and stop. */
  reset() {
    this.running = false;
    this.#endAt = null;
    this.remainingMs = this.durationMs;
  }

  /**
   * Move to a different mode without recording a completed session.
   * @param {Mode} mode
   */
  setMode(mode) {
    if (!isMode(mode)) throw new Error(`Unknown timer mode: ${mode}`);
    this.mode = mode;
    this.running = false;
    this.#endAt = null;
    this.remainingMs = this.durationMs;
  }

  /**
   * Update the length of one or more modes. The active mode snaps to the new
   * length only while idle, so a running countdown is never silently rewritten.
   *
   * @param {Partial<Record<Mode, number>>} durations
   */
  setDurations(durations) {
    const wasIdleAtFullLength = !this.running && this.remainingMs === this.durationMs;
    this.durations = sanitizeDurations({ ...this.durations, ...durations });
    if (wasIdleAtFullLength) this.remainingMs = this.durationMs;
    else this.remainingMs = Math.min(this.remainingMs, this.durationMs);
  }

  /**
   * Which mode naturally follows the current one.
   * @param {{ completed?: boolean }} [options]
   * @returns {Mode}
   */
  nextMode({ completed = false } = {}) {
    if (this.mode !== 'focus') return 'focus';
    const cycleFinished =
      completed && this.completedFocus > 0 && this.completedFocus % LONG_BREAK_EVERY === 0;
    return cycleFinished ? 'long' : 'short';
  }

  /**
   * Record the current session as finished and return the next mode.
   * Focus sessions increment the counter; breaks do not.
   *
   * @returns {Mode}
   */
  complete() {
    if (this.mode === 'focus') this.completedFocus += 1;
    return this.nextMode({ completed: true });
  }

  /**
   * Abandon the current session and move on. Does not count as completed.
   * @returns {Mode}
   */
  skip() {
    return this.nextMode({ completed: false });
  }
}
