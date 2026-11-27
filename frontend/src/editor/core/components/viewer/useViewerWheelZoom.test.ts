import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useViewerWheelZoom } from "@editor/components/viewer/useViewerWheelZoom";

let now = 0;
let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  now = 0;
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => vi.unstubAllGlobals());

/** Runs animation frames 16 ms apart until the glide has nothing left to pay. */
function settle() {
  for (let i = 0; i < 200 && frames.length > 0; i++) {
    const batch = frames;
    frames = [];
    now += 16;
    batch.forEach((cb) => cb(now));
  }
}

const totalFactor = (zoomBy: { mock: { calls: unknown[][] } }) =>
  zoomBy.mock.calls.reduce((product, [factor]) => product * (factor as number), 1);

function setup() {
  const root = document.createElement("div");
  const viewport = document.createElement("div");
  viewport.setAttribute("data-viewer-viewport", "");
  root.appendChild(viewport);
  document.body.appendChild(root);
  viewport.getBoundingClientRect = () =>
    ({ left: 100, top: 50, width: 800, height: 600 }) as DOMRect;
  Object.defineProperty(viewport, "clientWidth", { value: 800 });
  Object.defineProperty(viewport, "clientHeight", { value: 600 });

  const zoomBy = vi.fn();
  const ref = { current: root };
  const hook = renderHook(() => useViewerWheelZoom(ref, zoomBy));
  const wheel = (init: WheelEventInit) => {
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    viewport.dispatchEvent(event);
    return event;
  };
  return { zoomBy, wheel, cleanup: () => (hook.unmount(), root.remove()) };
}

describe("useViewerWheelZoom", () => {
  test("zooms about the pointer, a notch at a time by the button step", () => {
    const { zoomBy, wheel, cleanup } = setup();

    const event = wheel({ ctrlKey: true, deltaY: -100, clientX: 400, clientY: 250 });

    expect(event.defaultPrevented).toBe(true);
    expect(zoomBy).not.toHaveBeenCalled();
    settle();
    expect(zoomBy.mock.calls.length).toBeGreaterThan(1);
    expect(zoomBy.mock.calls[0][1]).toEqual({ vx: 300, vy: 200 });
    expect(totalFactor(zoomBy)).toBeCloseTo(1.2, 6);

    zoomBy.mockClear();
    wheel({ ctrlKey: true, deltaY: 100, clientX: 400, clientY: 250 });
    settle();
    expect(totalFactor(zoomBy)).toBeCloseTo(1 / 1.2, 6);
    cleanup();
  });

  test("leaves a plain wheel to scroll the pages", () => {
    const { zoomBy, wheel, cleanup } = setup();

    const event = wheel({ deltaY: -100, clientX: 400, clientY: 250 });

    expect(event.defaultPrevented).toBe(false);
    expect(zoomBy).not.toHaveBeenCalled();
    cleanup();
  });

  test("caps a single large wheel delta at one notch", () => {
    const { zoomBy, wheel, cleanup } = setup();

    wheel({ ctrlKey: true, deltaY: -1000, clientX: 400, clientY: 250 });

    settle();
    expect(totalFactor(zoomBy)).toBeCloseTo(1.2, 6);
    cleanup();
  });
});
