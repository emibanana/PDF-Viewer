import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import Workbench from "@editor/components/layout/Workbench";

/**
 * One Workbench for the whole life of HomePage. HomePage renders different
 * element trees for its desktop and mobile layouts, and a component that
 * changes parent type remounts: the viewer would be torn down at every
 * breakpoint crossing and lose its unsaved annotation edits (annotations live
 * in the plugin's document, not in the file). The Workbench is therefore
 * rendered once into a detached host element, and each layout mounts a
 * {@link WorkbenchSlot} that adopts that element. The host is
 * `display: contents`, so the slot lays out exactly as the Workbench itself
 * would have.
 */
export function usePersistentWorkbenchHost(): HTMLElement {
  const [host] = useState(() => {
    const element = document.createElement("div");
    element.style.display = "contents";
    return element;
  });
  return host;
}

export function PersistentWorkbench({
  host,
}: {
  host: HTMLElement;
}): ReactElement {
  return createPortal(<Workbench />, host);
}

interface WorkbenchSlotProps {
  host: HTMLElement;
  className?: string;
  style?: CSSProperties;
}

/**
 * Place in a layout where the Workbench should appear. Layout effect, not a
 * passive one: the host must be attached before the browser paints, or the
 * layout switch flashes an empty workspace.
 */
export function WorkbenchSlot({
  host,
  className,
  style,
}: WorkbenchSlotProps): ReactElement {
  const slotRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    slot.appendChild(host);
  }, [host]);

  return <div ref={slotRef} className={className} style={style} />;
}
