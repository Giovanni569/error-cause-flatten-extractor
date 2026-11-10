# error-cause-flatten-extractor

Walks an error's `cause` chain depth-first and produces a flat list of all error messages and stack traces.

```js
import { flattenErrorCause, formatFlatErrorCause } from 'error-cause-flatten-extractor';

const root = new Error('root failed');
root.cause = new Error('inner failed');
root.cause.cause = new Error('innermost failed');

const flat = flattenErrorCause(root);
// [
//   { message: 'root failed', stack: '...', depth: 0, cyclic: false },
//   { message: 'inner failed', stack: '...', depth: 1, cyclic: false },
//   { message: 'innermost failed', stack: '...', depth: 2, cyclic: false },
// ]

console.log(formatFlatErrorCause(flat));
```

## Why this exists

Error `cause` chains are useful but awkward to report: each layer has its own message and stack, and a logger or UI usually wants a single flat list. This library does the walk once and returns plain objects, so you can filter, map, or render them however you like. The trade-off is that it only understands the standard `cause` property on Error-like objects; it does not follow arbitrary custom chains or parse stack strings.

## Edge cases

A cyclic `cause` chain is possible when code accidentally links errors back to an earlier one. This library records the repeated error as an entry with `cyclic: true` and does not descend into it again, so the output is finite. Non-Error causes (for example a string or number) are recorded as a single entry using `String(cause)` and have no stack.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

