import test from 'node:test';
import assert from 'node:assert/strict';

import { clamp, dayKey, formatClock, formatMinutes, MINUTE_MS } from '../assets/js/format.js';

test('formatClock renders a zero-padded countdown', () => {
  assert.equal(formatClock(25 * MINUTE_MS), '25:00');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(1000), '00:01');
  assert.equal(formatClock(59_999), '01:00');
  assert.equal(formatClock(90 * MINUTE_MS), '90:00');
});

test('formatClock rounds partial seconds up so the last second is visible', () => {
  assert.equal(formatClock(1), '00:01');
  assert.equal(formatClock(1.5), '00:01');
  assert.equal(formatClock(999), '00:01');
});

test('formatClock survives junk input', () => {
  assert.equal(formatClock(-5000), '00:00');
  assert.equal(formatClock(Number.NaN), '00:00');
  assert.equal(formatClock(Number.POSITIVE_INFINITY), '00:00');
});

test('formatMinutes uses compact human units', () => {
  assert.equal(formatMinutes(0), '0m');
  assert.equal(formatMinutes(45 * MINUTE_MS), '45m');
  assert.equal(formatMinutes(60 * MINUTE_MS), '1h');
  assert.equal(formatMinutes(135 * MINUTE_MS), '2h 15m');
});

test('dayKey follows the local calendar, not UTC', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(dayKey(new Date(2026, 11, 31, 0, 1)), '2026-12-31');
});

test('clamp keeps values inside the range', () => {
  assert.equal(clamp(5, 1, 10), 5);
  assert.equal(clamp(-5, 1, 10), 1);
  assert.equal(clamp(50, 1, 10), 10);
  assert.equal(clamp(Number.NaN, 2, 10), 2);
});
