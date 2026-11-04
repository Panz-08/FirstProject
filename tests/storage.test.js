import test from 'node:test';
import assert from 'node:assert/strict';

import { createStore, STORAGE_PREFIX } from '../assets/js/storage.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));

  return {
    data,
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test('set and get round-trip JSON values under a namespaced key', () => {
  const storage = fakeStorage();
  const store = createStore(storage);

  assert.equal(store.set('tasks', [{ id: 'a', title: 'Hello' }]), true);
  assert.deepEqual(store.get('tasks'), [{ id: 'a', title: 'Hello' }]);
  assert.equal(storage.data.has(`${STORAGE_PREFIX}tasks`), true);
});

test('get returns the fallback for missing or corrupt entries', () => {
  const storage = fakeStorage({ [`${STORAGE_PREFIX}broken`]: '{not json' });
  const store = createStore(storage);

  assert.equal(store.get('missing', 'fallback'), 'fallback');
  assert.equal(store.get('broken', 'fallback'), 'fallback');
  assert.equal(store.get('missing'), null);
});

test('remove deletes the namespaced entry only', () => {
  const storage = fakeStorage({ [`${STORAGE_PREFIX}tasks`]: '[]', other: 'keep me' });
  const store = createStore(storage);

  store.remove('tasks');

  assert.equal(storage.getItem(`${STORAGE_PREFIX}tasks`), null);
  assert.equal(storage.getItem('other'), 'keep me');
});

test('a storage backend that throws degrades gracefully', () => {
  const hostile = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota exceeded');
    },
    removeItem() {
      throw new Error('denied');
    },
  };

  const store = createStore(hostile);

  assert.equal(store.get('anything', 'safe'), 'safe');
  assert.equal(store.set('anything', 1), false);
  assert.doesNotThrow(() => store.remove('anything'));
});

test('the store falls back to memory when no backend is available', () => {
  const store = createStore(null);

  store.set('theme', 'light');
  assert.equal(store.get('theme'), 'light');
});
