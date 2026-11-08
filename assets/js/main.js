/**
 * FocusFlow UI layer: wires the pure modules to the DOM and localStorage.
 */

import { dayKey, formatClock, formatMinutes } from './format.js';
import { MODE_CAPTIONS, MODE_LABELS, MODES, PomodoroTimer } from './timer.js';
import { addTask, clearCompleted, removeTask, sanitizeTasks, taskStats, toggleTask } from './tasks.js';
import { createStore } from './storage.js';

const BASE_TITLE = 'FocusFlow - Pomodoro timer & task list';
const RING_CIRCUMFERENCE = 2 * Math.PI * 120; // r="120" in the SVG ring
const TICK_MS = 250;
const DOTS_PER_CYCLE = 4;

const store = createStore();

const el = {
  root: document.documentElement,
  themeToggle: document.getElementById('theme-toggle'),
  tabs: [...document.querySelectorAll('.tab')],
  timerBox: document.getElementById('timer'),
  ring: document.getElementById('ring-progress'),
  time: document.getElementById('time-display'),
  caption: document.getElementById('mode-caption'),
  dots: document.getElementById('session-dots'),
  toggle: document.getElementById('toggle-btn'),
  reset: document.getElementById('reset-btn'),
  skip: document.getElementById('skip-btn'),
  form: document.getElementById('task-form'),
  input: document.getElementById('task-input'),
  list: document.getElementById('task-list'),
  empty: document.getElementById('task-empty'),
  count: document.getElementById('task-count'),
  clearDone: document.getElementById('clear-done'),
  statSessions: document.getElementById('stat-sessions'),
  statMinutes: document.getElementById('stat-minutes'),
  statOpen: document.getElementById('stat-open'),
  status: document.getElementById('sr-status'),
  themeColor: document.querySelector('meta[name="theme-color"]'),
};

/* ---------------------------------------------------------------------------
   State
   --------------------------------------------------------------------------- */

const timer = new PomodoroTimer(loadTimerState());
const state = {
  tasks: sanitizeTasks(store.get('tasks', [])),
  stats: loadStats(),
};

/** @type {number | null} */
let ticker = null;
let announceHandle = 0;
let audio = null;

function loadTimerState() {
  const saved = store.get('timer', null);
  if (!saved || typeof saved !== 'object') return {};

  return {
    mode: MODES.includes(saved.mode) ? saved.mode : 'focus',
    durations: saved.durations,
    completedFocus: Number.isInteger(saved.completedFocus) ? saved.completedFocus : 0,
    remainingMs: Number.isFinite(saved.remainingMs) ? saved.remainingMs : undefined,
  };
}

function loadStats() {
  const today = dayKey();
  const saved = store.get('stats', null);

  if (saved && saved.day === today) {
    return {
      day: today,
      sessions: Number.isFinite(saved.sessions) ? Math.max(0, Math.trunc(saved.sessions)) : 0,
      focusMs: Number.isFinite(saved.focusMs) ? Math.max(0, saved.focusMs) : 0,
    };
  }

  return { day: today, sessions: 0, focusMs: 0 };
}

function persistTimer() {
  store.set('timer', {
    mode: timer.mode,
    durations: timer.durations,
    completedFocus: timer.completedFocus,
    remainingMs: timer.remainingMs,
  });
}

function persistTasks() {
  store.set('tasks', state.tasks);
}

function persistStats() {
  store.set('stats', state.stats);
}

/* ---------------------------------------------------------------------------
   Rendering
   --------------------------------------------------------------------------- */

function renderAll() {
  renderTimer();
  renderTasks();
  renderStats();
}

function renderTimer() {
  const { mode, running, remainingMs, durationMs } = timer;

  el.time.textContent = formatClock(remainingMs);
  el.ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - timer.progress));
  el.timerBox.classList.toggle('is-running', running);

  if (running) el.toggle.textContent = 'Pause';
  else el.toggle.textContent = remainingMs < durationMs ? 'Resume' : 'Start';

  el.caption.textContent = MODE_CAPTIONS[mode];

  for (const tab of el.tabs) {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-pressed', String(active));
  }

  document.title = running ? `${formatClock(remainingMs)} · ${MODE_LABELS[mode]}` : BASE_TITLE;
  renderDots();
}

function buildDots() {
  const dots = Array.from({ length: DOTS_PER_CYCLE }, () => {
    const dot = document.createElement('span');
    dot.className = 'dot';
    return dot;
  });
  el.dots.replaceChildren(...dots);
}

function renderDots() {
  const inCycle = timer.completedFocus % DOTS_PER_CYCLE;
  const finishedCycle = timer.completedFocus > 0 && inCycle === 0 && timer.mode === 'long';
  const filled = finishedCycle ? DOTS_PER_CYCLE : inCycle;

  [...el.dots.children].forEach((dot, index) => {
    dot.classList.toggle('is-filled', index < filled);
  });
}

function renderTasks() {
  const fragment = document.createDocumentFragment();

  for (const task of state.tasks) {
    const item = document.createElement('li');
    item.className = `task${task.done ? ' is-done' : ''}`;
    item.dataset.id = task.id;

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.dataset.action = 'toggle';
    checkbox.setAttribute('aria-label', `${task.done ? 'Reopen' : 'Complete'} "${task.title}"`);

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    label.append(checkbox, title);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'task-del';
    remove.dataset.action = 'delete';
    remove.setAttribute('aria-label', `Delete "${task.title}"`);
    remove.textContent = '×';

    item.append(label, remove);
    fragment.append(item);
  }

  el.list.replaceChildren(fragment);

  const { total, done, remaining } = taskStats(state.tasks);
  el.empty.hidden = total > 0;
  el.count.textContent = `${remaining} open`;
  el.clearDone.hidden = done === 0;
}

function renderStats() {
  const today = dayKey();
  if (state.stats.day !== today) {
    state.stats = { day: today, sessions: 0, focusMs: 0 };
    persistStats();
  }

  const { remaining } = taskStats(state.tasks);
  el.statSessions.textContent = String(state.stats.sessions);
  el.statMinutes.textContent = formatMinutes(state.stats.focusMs);
  el.statOpen.textContent = String(remaining);
}

function announce(message) {
  window.clearTimeout(announceHandle);
  el.status.textContent = '';
  announceHandle = window.setTimeout(() => {
    el.status.textContent = message;
  }, 40);
}

/* ---------------------------------------------------------------------------
   Timer controls
   --------------------------------------------------------------------------- */

function startTicker() {
  if (ticker !== null) return;
  ticker = window.setInterval(onTick, TICK_MS);
}

function stopTicker() {
  if (ticker === null) return;
  window.clearInterval(ticker);
  ticker = null;
}

function onTick() {
  const event = timer.tick(Date.now());
  if (event) {
    handleSessionEnd();
    return;
  }
  renderTimer();
}

function toggleTimer() {
  if (timer.running) {
    timer.pause(Date.now());
    stopTicker();
    announce('Timer paused.');
  } else {
    if (timer.remainingMs <= 0) timer.reset();
    unlockAudio();
    timer.start(Date.now());
    startTicker();
    announce(`${MODE_LABELS[timer.mode]} started.`);
  }

  persistTimer();
  renderTimer();
}

function resetTimer() {
  stopTicker();
  timer.reset();
  persistTimer();
  renderTimer();
  announce('Timer reset.');
}

function skipSession() {
  stopTicker();
  const next = timer.skip();
  timer.setMode(next);
  persistTimer();
  renderAll();
  announce(`Skipped to ${MODE_LABELS[next].toLowerCase()}.`);
}

function handleSessionEnd() {
  stopTicker();
  const finished = timer.mode;

  if (finished === 'focus') {
    state.stats.sessions += 1;
    state.stats.focusMs += timer.durationMs;
    persistStats();
  }

  playChime();

  const next = timer.complete();
  timer.setMode(next);
  persistTimer();
  renderAll();

  announce(
    finished === 'focus'
      ? `Focus session complete. ${MODE_LABELS[next]} time.`
      : 'Break over. Ready for another focus block?',
  );
}

/* ---------------------------------------------------------------------------
   Audio: a short two-note chime, generated with the Web Audio API
   --------------------------------------------------------------------------- */

function unlockAudio() {
  try {
    if (!audio) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audio = new AudioContextClass();
    }
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

function playChime() {
  if (!audio) return;

  try {
    const start = audio.currentTime;
    [659.25, 880].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = start + index * 0.18;

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);

      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.55);
    });
  } catch {
    // Audio is a nice-to-have; never let it break the timer.
  }
}

/* ---------------------------------------------------------------------------
   Theme
   --------------------------------------------------------------------------- */

function applyTheme(theme) {
  el.root.dataset.theme = theme;
  const dark = theme === 'dark';

  el.themeToggle.setAttribute('aria-pressed', String(dark));
  el.themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  el.themeColor?.setAttribute('content', dark ? '#080b14' : '#f2f4fa');
}

function initTheme() {
  const saved = store.get('theme', null);
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
  applyTheme(saved === 'light' || saved === 'dark' ? saved : prefersLight ? 'light' : 'dark');
}

function toggleTheme() {
  const next = el.root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  store.set('theme', next);
  announce(`${next === 'dark' ? 'Dark' : 'Light'} theme enabled.`);
}

/* ---------------------------------------------------------------------------
   Events
   --------------------------------------------------------------------------- */

el.toggle.addEventListener('click', toggleTimer);
el.reset.addEventListener('click', resetTimer);
el.skip.addEventListener('click', skipSession);
el.themeToggle.addEventListener('click', toggleTheme);

for (const tab of el.tabs) {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    if (!MODES.includes(mode) || mode === timer.mode) return;

    stopTicker();
    timer.setMode(mode);
    persistTimer();
    renderAll();
    announce(`${MODE_LABELS[mode]} selected.`);
  });

  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();

    const index = el.tabs.indexOf(tab);
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const next = el.tabs[(index + offset + el.tabs.length) % el.tabs.length];
    next.focus();
    next.click();
  });
}

el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = el.input.value.trim();
  if (!title) return;

  try {
    state.tasks = addTask(state.tasks, title);
  } catch {
    announce('That task needs a title.');
    return;
  }

  el.input.value = '';
  persistTasks();
  renderTasks();
  renderStats();
  announce(`Added "${state.tasks[0].title}".`);
  el.input.focus();
});

el.list.addEventListener('change', (event) => {
  const checkbox = event.target;
  if (!(checkbox instanceof HTMLInputElement) || checkbox.dataset.action !== 'toggle') return;

  const id = checkbox.closest('.task')?.dataset.id;
  if (!id) return;

  const task = state.tasks.find((entry) => entry.id === id);
  state.tasks = toggleTask(state.tasks, id);
  persistTasks();
  renderTasks();
  renderStats();
  if (task) announce(`"${task.title}" ${task.done ? 'reopened' : 'completed'}.`);
});

el.list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="delete"]');
  if (!(button instanceof HTMLElement)) return;

  const id = button.closest('.task')?.dataset.id;
  if (!id) return;

  state.tasks = removeTask(state.tasks, id);
  persistTasks();
  renderTasks();
  renderStats();
  announce('Task deleted.');
});

el.clearDone.addEventListener('click', () => {
  const removed = state.tasks.filter((task) => task.done).length;
  state.tasks = clearCompleted(state.tasks);
  persistTasks();
  renderTasks();
  renderStats();
  announce(`${removed} completed ${removed === 1 ? 'task' : 'tasks'} cleared.`);
});

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const target = event.target;
  if (target instanceof HTMLElement) {
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    // Let the browser handle Space on a focused button or link.
    if (event.key === ' ' && target.closest('button, a')) return;
  }

  switch (event.key.toLowerCase()) {
    case ' ':
      event.preventDefault();
      toggleTimer();
      break;
    case 'r':
      resetTimer();
      break;
    case 's':
      skipSession();
      break;
    case 't':
      toggleTheme();
      break;
    case 'n':
      event.preventDefault();
      el.input.focus();
      break;
    default:
      break;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && timer.running) onTick();
});

window.addEventListener('pagehide', () => {
  if (timer.running) timer.pause(Date.now());
  persistTimer();
});

/* ---------------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------------- */

buildDots();
initTheme();
renderAll();
