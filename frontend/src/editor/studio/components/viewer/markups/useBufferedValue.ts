import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A field value that is shown at once but committed after `delayMs` without further edits, on
 * `flush`, and when the field unmounts, so typing or dragging produces one undo step instead of
 * one per keystroke. `external` is the committed value: it replaces the shown one whenever it
 * changes and no edit is waiting (an undo, or another panel editing the same markup).
 */
export function useBufferedValue<T extends string | number>(
  external: T,
  commit: (value: T) => void,
  delayMs = 350,
): readonly [T, (value: T) => void, () => void] {
  const [shown, setShown] = useState<T>(external);
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);

  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  useEffect(() => {
    if (!pending.current) setShown(external);
  }, [external]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const waiting = pending.current;
    pending.current = null;
    if (waiting) commitRef.current(waiting.value);
  }, []);

  const change = useCallback(
    (value: T) => {
      setShown(value);
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  useEffect(() => flush, [flush]);

  return [shown, change, flush] as const;
}
