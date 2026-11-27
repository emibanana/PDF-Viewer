function plainEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => plainEqual(v, b[i]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((k) => k in right && plainEqual(left[k], right[k]));
}

/**
 * `next` with every snapshot that equals the same-id one in `prev` replaced by
 * that previous object. Overlays are memoised on snapshot identity, so a
 * keystroke that changes one run must not hand every other run on the page a
 * new object. Snapshots must be plain data (numbers, strings, arrays, objects).
 */
export function reuseSnapshots<T extends { id: string }>(
  prev: readonly T[],
  next: readonly T[],
): T[] {
  const prevById = new Map(prev.map((s) => [s.id, s]));
  return next.map((s) => {
    const old = prevById.get(s.id);
    return old && plainEqual(old, s) ? old : s;
  });
}
