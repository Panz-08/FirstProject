/**
 * Task list model.
 *
 * Every operation returns a new array instead of mutating the input, which
 * keeps rendering predictable and makes the functions trivial to test.
 */

export const MAX_TITLE_LENGTH = 120;

let sequence = 0;

/** Unique-enough id without pulling in a dependency. */
function createId() {
  sequence += 1;
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `t_${time}_${sequence.toString(36)}${random}`;
}

/**
 * Collapse whitespace and enforce the length limit.
 * @param {unknown} title
 * @returns {string}
 */
export function normalizeTitle(title) {
  return String(title ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
}

/**
 * @typedef {object} Task
 * @property {string} id
 * @property {string} title
 * @property {boolean} done
 * @property {number} createdAt
 */

/**
 * @param {unknown} title
 * @param {{ id?: string, createdAt?: number }} [options]
 * @returns {Task}
 */
export function createTask(title, { id = createId(), createdAt = Date.now() } = {}) {
  const clean = normalizeTitle(title);
  if (!clean) throw new Error('A task needs a title');
  return { id, title: clean, done: false, createdAt };
}

/**
 * @param {Task[]} tasks
 * @param {unknown} title
 * @param {{ id?: string, createdAt?: number }} [options]
 * @returns {Task[]}
 */
export function addTask(tasks, title, options) {
  return [createTask(title, options), ...tasks];
}

/**
 * @param {Task[]} tasks
 * @param {string} id
 * @returns {Task[]}
 */
export function toggleTask(tasks, id) {
  return tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
}

/**
 * @param {Task[]} tasks
 * @param {string} id
 * @returns {Task[]}
 */
export function removeTask(tasks, id) {
  return tasks.filter((task) => task.id !== id);
}

/**
 * @param {Task[]} tasks
 * @returns {Task[]}
 */
export function clearCompleted(tasks) {
  return tasks.filter((task) => !task.done);
}

/**
 * @param {Task[]} tasks
 * @returns {{ total: number, done: number, remaining: number }}
 */
export function taskStats(tasks) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  return { total, done, remaining: total - done };
}

/**
 * Drop anything that does not look like a task. Local storage can be edited by
 * hand (or left over from an older version), so treat it as untrusted input.
 *
 * @param {unknown} value
 * @returns {Task[]}
 */
export function sanitizeTasks(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  /** @type {Task[]} */
  const tasks = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;

    const id = typeof item.id === 'string' && item.id ? item.id : createId();
    const title = normalizeTitle(item.title);
    if (!title || seen.has(id)) continue;

    seen.add(id);
    tasks.push({
      id,
      title,
      done: item.done === true,
      createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : Date.now(),
    });
  }

  return tasks;
}
