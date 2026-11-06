import test from 'node:test';
import assert from 'node:assert/strict';

import { flattenErrorCause, formatFlatErrorCause } from '../src/index.js';

test('returns empty array for null/undefined', () => {
  assert.deepEqual(flattenErrorCause(null), []);
  assert.deepEqual(flattenErrorCause(undefined), []);
});

test('flattens a single error without cause', () => {
  const err = new Error('boom');
  err.stack = 'fake-stack';
  const flat = flattenErrorCause(err);
  assert.equal(flat.length, 1);
  assert.equal(flat[0].message, 'boom');
  assert.equal(flat[0].stack, 'fake-stack');
  assert.equal(flat[0].depth, 0);
  assert.equal(flat[0].cyclic, false);
});

test('walks nested causes depth-first', () => {
  const a = new Error('a');
  const b = new Error('b');
  const c = new Error('c');
  a.cause = b;
  b.cause = c;
  const flat = flattenErrorCause(a);
  assert.deepEqual(
    flat.map((e) => [e.message, e.depth]),
    [
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]
  );
});

test('handles non-Error causes by stringifying them', () => {
  const a = new Error('a');
  a.cause = 42;
  const flat = flattenErrorCause(a);
  assert.equal(flat.length, 2);
  assert.equal(flat[1].message, '42');
  assert.equal(flat[1].stack, undefined);
  assert.equal(flat[1].depth, 1);
});

test('marks cyclic references and stops descending', () => {
  const a = new Error('a');
  const b = new Error('b');
  a.cause = b;
  b.cause = a;
  const flat = flattenErrorCause(a);
  assert.equal(flat.length, 3);
  assert.equal(flat[0].message, 'a');
  assert.equal(flat[0].cyclic, false);
  assert.equal(flat[1].message, 'b');
  assert.equal(flat[1].cyclic, false);
  assert.equal(flat[2].message, 'a');
  assert.equal(flat[2].cyclic, true);
  assert.equal(flat[2].depth, 2);
});

test('self-referential cause is marked cyclic', () => {
  const a = new Error('a');
  a.cause = a;
  const flat = flattenErrorCause(a);
  assert.equal(flat.length, 2);
  assert.equal(flat[1].cyclic, true);
  assert.equal(flat[1].depth, 1);
});

test('deep chain does not overflow the call stack', () => {
  const root = new Error('root');
  let current = root;
  for (let i = 1; i < 5000; i++) {
    const next = new Error(`e${i}`);
    current.cause = next;
    current = next;
  }
  const flat = flattenErrorCause(root);
  assert.equal(flat.length, 5000);
  assert.equal(flat[0].message, 'root');
  assert.equal(flat[4999].message, 'e4999');
});

test('formatFlatErrorCause returns empty string for empty input', () => {
  assert.equal(formatFlatErrorCause([]), '');
});

test('formatFlatErrorCause includes depth and message', () => {
  const out = formatFlatErrorCause([
    { message: 'a', stack: 's1', depth: 0, cyclic: false },
    { message: 'b', stack: undefined, depth: 1, cyclic: true },
  ]);
  assert.equal(out, '[depth 0] a\ns1\n\n[depth 1] (cyclic) b');
});

test('formatFlatErrorCause handles entries without stacks', () => {
  const out = formatFlatErrorCause([{ message: 'x', stack: undefined, depth: 0, cyclic: false }]);
  assert.equal(out, '[depth 0] x');
});
