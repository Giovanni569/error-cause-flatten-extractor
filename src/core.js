/**
 * Walks an error's `cause` chain depth-first and collects a flat list of entries.
 *
 * Design decision: when the same error object appears more than once in the chain
 * (a cycle), we stop descending into it but still record the entry. This avoids
 * infinite loops while preserving the fact that the error was reached again.
 *
 * Only `message` and `stack` are extracted. We intentionally do not walk arbitrary
 * `cause` properties on non-Error objects unless they are Error instances, because
 * the standard `Error.cause` contract is that the cause is an Error (or at least
 * an object with a `message`). Non-Error causes are recorded as-is via `String`.
 */

/**
 * @typedef {Object} FlatErrorEntry
 * @property {string} message
 * @property {string|undefined} stack
 * @property {number} depth
 * @property {boolean} cyclic
 */

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isErrorLike(err) {
  return (
    err !== null &&
    typeof err === 'object' &&
    'message' in err &&
    typeof /** @type {{message?: unknown}} */ (err).message === 'string'
  );
}

/**
 * Depth-first walk of the cause chain.
 *
 * We use an explicit stack rather than recursion so that extremely deep chains
 * (thousands of causes) do not overflow the call stack. The stack holds pairs of
 * `[error, depth]` and we process the cause before the sibling (there are no
 * siblings in a single-linked cause chain, but the ordering is still depth-first).
 *
 * @param {unknown} root
 * @returns {FlatErrorEntry[]}
 */
export function flattenErrorCause(root) {
  /** @type {FlatErrorEntry[]} */
  const out = [];
  if (root === null || root === undefined) {
    return out;
  }

  /** @type {Set<unknown>} */
  const seen = new Set();
  /** @type {Array<[unknown, number]>} */
  const stack = [[root, 0]];

  while (stack.length > 0) {
    const [current, depth] = stack.pop();
    if (current === null || current === undefined) {
      continue;
    }

    const cyclic = seen.has(current);
    if (!cyclic) {
      seen.add(current);
    }

    if (isErrorLike(current)) {
      const err = /** @type {{message: string, stack?: string, cause?: unknown}} */ (current);
      out.push({
        message: err.message,
        stack: typeof err.stack === 'string' ? err.stack : undefined,
        depth,
        cyclic,
      });
      if (!cyclic && 'cause' in err) {
        stack.push([err.cause, depth + 1]);
      }
    } else {
      // Non-Error cause: record its string form, no stack, and do not descend.
      out.push({
        message: String(current),
        stack: undefined,
        depth,
        cyclic,
      });
    }
  }

  return out;
}

/**
 * Formats the flat entries into a single human-readable string.
 *
 * Format choice: one block per entry, separated by a blank line. Each block starts
 * with `[depth N]` so the chain order is obvious even when stacks are multi-line.
 * The stack is included verbatim if present.
 *
 * @param {FlatErrorEntry[]} entries
 * @returns {string}
 */
export function formatFlatErrorCause(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '';
  }
  return entries
    .map((entry) => {
      const header = `[depth ${entry.depth}]${entry.cyclic ? ' (cyclic)' : ''} ${entry.message}`;
      return entry.stack ? `${header}\n${entry.stack}` : header;
    })
    .join('\n\n');
}
