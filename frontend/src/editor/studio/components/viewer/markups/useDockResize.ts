import { useCallback, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Pointer handler for a dock's resize edge. `read` gives the size when the drag starts and
 * `direction` is the sign of growth per pixel moved: dragging up grows a bottom dock (-1 on y),
 * dragging left grows a right dock (-1 on x).
 */
export function useDockResize(axis: "x" | "y", direction: 1 | -1, read: () => number, write: (size: number) => void) {
  return useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      const start = axis === "x" ? event.clientX : event.clientY;
      const startSize = read();
      const onMove = (move: PointerEvent) => {
        const current = axis === "x" ? move.clientX : move.clientY;
        write(startSize + (current - start) * direction);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [axis, direction, read, write],
  );
}
