import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DURATIONS,
  LONG_BREAK_EVERY,
  PomodoroTimer,
  sanitizeDurations,
} from '../assets/js/timer.js';

// One minute is the smallest duration the app accepts, so it keeps the tests fast.
const FOCUS = 60_000;
const SHORT = 120_000;

test('a fresh timer starts paused at the full focus length', () => {
  const timer = new PomodoroTimer();

  assert.equal(timer.mode, 'focus');
  assert.equal(timer.remainingMs, DEFAULT_DURATIONS.focus);
  assert.equal(timer.durationMs, DEFAULT_DURATIONS.focus);
  assert.equal(timer.running, false);
  assert.equal(timer.progress, 1);
});

test('start and tick count down against wall time', () => {
  const timer = new PomodoroTimer({ durations: { focus: FOCUS } });

  assert.equal(timer.start(1000), true);
  assert.equal(timer.running, true);
  assert.equal(timer.tick(16_000), null);
  assert.equal(timer.remainingMs, 45_000);
  assert.equal(timer.elapsedMs, 15_000);
  assert.equal(timer.progress, 0.75);
});

test('pause freezes the remaining time and resume continues from it', () => {
  const timer = new PomodoroTimer({ durations: { focus: FOCUS } });

  timer.start(0);
  timer.tick(15_000);
  assert.equal(timer.pause(15_000), true);
  assert.equal(timer.running, false);
  assert.equal(timer.remainingMs, 45_000);

  // Time passing while paused must not eat into the session.
  assert.equal(timer.pause(999_999), false);
  timer.start(100_000);
  timer.tick(105_000);
  assert.equal(timer.remainingMs, 40_000);
});

test('tick reports completion exactly once', () => {
  const timer = new PomodoroTimer({ durations: { focus: FOCUS } });

  timer.start(0);
  assert.deepEqual(timer.tick(FOCUS), { mode: 'focus', finished: true });
  assert.equal(timer.running, false);
  assert.equal(timer.remainingMs, 0);
  assert.equal(timer.tick(FOCUS + 5000), null);
});

test('a finished timer cannot be started again until it is reset', () => {
  const timer = new PomodoroTimer({ durations: { focus: FOCUS } });

  timer.start(0);
  timer.tick(FOCUS);
  assert.equal(timer.start(FOCUS + 1), false);

  timer.reset();
  assert.equal(timer.remainingMs, FOCUS);
  assert.equal(timer.start(FOCUS + 2), true);
});

test('reset restores the full duration of the current mode', () => {
  const timer = new PomodoroTimer({ durations: { focus: FOCUS } });

  timer.start(0);
  timer.tick(20_000);
  timer.reset();

  assert.equal(timer.running, false);
  assert.equal(timer.remainingMs, FOCUS);
});

test('setMode switches modes, stops the clock, and reloads the duration', () => {
  const timer = new PomodoroTimer({ durations: { focus: FOCUS, short: SHORT } });

  timer.start(0);
  timer.setMode('short');

  assert.equal(timer.mode, 'short');
  assert.equal(timer.running, false);
  assert.equal(timer.remainingMs, SHORT);

  assert.throws(() => timer.setMode('nap'), /Unknown timer mode/);
});

test('a long break lands after every fourth completed focus session', () => {
  const timer = new PomodoroTimer({ durations: { focus: FOCUS } });

  for (let session = 1; session <= LONG_BREAK_EVERY; session += 1) {
    timer.setMode('focus');
    timer.start(0);
    timer.tick(FOCUS);

    const next = timer.complete();
    assert.equal(next, session === LONG_BREAK_EVERY ? 'long' : 'short');
    timer.setMode(next);
  }

  assert.equal(timer.completedFocus, LONG_BREAK_EVERY);
});

test('completing a break returns to focus without touching the counter', () => {
  const timer = new PomodoroTimer({ durations: { short: FOCUS } });
  timer.setMode('short');

  timer.start(0);
  timer.tick(FOCUS);

  assert.equal(timer.complete(), 'focus');
  assert.equal(timer.completedFocus, 0);
});

test('skipping never counts as a completed session', () => {
  const timer = new PomodoroTimer();
  assert.equal(timer.skip(), 'short');
  assert.equal(timer.completedFocus, 0);

  // Even with a full cycle banked, skipping a focus block is not a long break.
  timer.completedFocus = LONG_BREAK_EVERY;
  assert.equal(timer.skip(), 'short');
  assert.equal(timer.completedFocus, LONG_BREAK_EVERY);
});

test('sanitizeDurations clamps values and ignores junk', () => {
  const durations = sanitizeDurations({
    focus: 90_000,
    short: 0,
    long: 'abc',
  });

  assert.equal(durations.focus, 90_000);
  assert.equal(durations.short, 60_000, 'below the one-minute floor gets clamped');
  assert.equal(durations.long, DEFAULT_DURATIONS.long);
});

test('restoring a saved remaining time clamps it to the current duration', () => {
  assert.equal(new PomodoroTimer({ durations: { focus: FOCUS }, remainingMs: 999_999 }).remainingMs, FOCUS);
  assert.equal(new PomodoroTimer({ durations: { focus: FOCUS }, remainingMs: -1 }).remainingMs, 0);
  assert.equal(new PomodoroTimer({ remainingMs: Number.NaN }).remainingMs, DEFAULT_DURATIONS.focus);
});

test('setDurations keeps a running session intact', () => {
  const timer = new PomodoroTimer({ durations: { focus: FOCUS } });

  timer.start(0);
  timer.tick(20_000);
  timer.setDurations({ focus: 120_000 });

  assert.equal(timer.durationMs, 120_000);
  assert.equal(timer.remainingMs, 40_000, 'a running countdown is not rewritten');
});
