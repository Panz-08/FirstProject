import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addTask,
  clearCompleted,
  createTask,
  MAX_TITLE_LENGTH,
  normalizeTitle,
  removeTask,
  sanitizeTasks,
  taskStats,
  toggleTask,
} from '../assets/js/tasks.js';

test('createTask trims and collapses whitespace', () => {
  const task = createTask('   Write   the   README  ');

  assert.equal(task.title, 'Write the README');
  assert.equal(task.done, false);
  assert.equal(typeof task.id, 'string');
  assert.ok(task.id.length > 0);
});

test('createTask rejects empty titles', () => {
  assert.throws(() => createTask('   '), /needs a title/);
  assert.throws(() => createTask(null), /needs a title/);
});

test('titles are capped at the maximum length', () => {
  const long = 'a'.repeat(MAX_TITLE_LENGTH + 40);
  assert.equal(normalizeTitle(long).length, MAX_TITLE_LENGTH);
  assert.equal(createTask(long).title.length, MAX_TITLE_LENGTH);
});

test('addTask prepends without mutating the original list', () => {
  const first = createTask('First', { id: 'a' });
  const list = [first];
  const next = addTask(list, 'Second', { id: 'b' });

  assert.deepEqual(
    next.map((task) => task.id),
    ['b', 'a'],
  );
  assert.equal(list.length, 1);
});

test('toggleTask flips only the matching task', () => {
  const list = [createTask('One', { id: 'a' }), createTask('Two', { id: 'b' })];
  const toggled = toggleTask(list, 'b');

  assert.equal(toggled[0].done, false);
  assert.equal(toggled[1].done, true);
  assert.equal(list[1].done, false, 'the input list is untouched');

  assert.equal(toggleTask(toggled, 'b')[1].done, false);
});

test('removeTask drops one task and keeps the rest in order', () => {
  const list = [createTask('One', { id: 'a' }), createTask('Two', { id: 'b' })];

  assert.deepEqual(
    removeTask(list, 'a').map((task) => task.id),
    ['b'],
  );
  assert.equal(removeTask(list, 'missing').length, 2);
});

test('clearCompleted keeps only open tasks', () => {
  const list = [createTask('One', { id: 'a' }), createTask('Two', { id: 'b' })];
  const withDone = toggleTask(list, 'a');

  assert.deepEqual(
    clearCompleted(withDone).map((task) => task.id),
    ['b'],
  );
});

test('taskStats counts open and completed work', () => {
  const list = [createTask('One', { id: 'a' }), createTask('Two', { id: 'b' }), createTask('Three', { id: 'c' })];
  const stats = taskStats(toggleTask(toggleTask(list, 'a'), 'b'));

  assert.deepEqual(stats, { total: 3, done: 2, remaining: 1 });
  assert.deepEqual(taskStats([]), { total: 0, done: 0, remaining: 0 });
});

test('sanitizeTasks drops junk, duplicate ids, and empty titles', () => {
  const cleaned = sanitizeTasks([
    { id: 'a', title: '  Real task  ', done: true, createdAt: 123 },
    { id: 'a', title: 'Duplicate id' },
    { id: 'b', title: '   ' },
    { id: 'c', title: 42 },
    null,
    'not a task',
    { id: 'd', title: 'Another', done: 'yes' },
  ]);

  assert.deepEqual(cleaned, [
    { id: 'a', title: 'Real task', done: true, createdAt: 123 },
    { id: 'c', title: '42', done: false, createdAt: cleaned[1].createdAt },
    { id: 'd', title: 'Another', done: false, createdAt: cleaned[2].createdAt },
  ]);
});

test('sanitizeTasks rejects non-arrays', () => {
  assert.deepEqual(sanitizeTasks(null), []);
  assert.deepEqual(sanitizeTasks({ tasks: [] }), []);
});
