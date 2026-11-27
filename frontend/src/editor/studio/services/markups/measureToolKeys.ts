import { measureSpecForToolId } from "@editor/services/markups/markupModel";

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
}

/** Fields and editors keep Enter for themselves; so does a focused button, where Enter presses it. */
export function isEnterConsumer(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName))
  );
}

/**
 * Whether Enter should finish the shape being drawn: a multi-click measure tool is armed (a
 * length is finished by its second click, so Enter has nothing to finish there) and the key is
 * a bare Enter that no field or button owns.
 */
export function enterFinishesShape(toolId: string | null, event: KeyLike): boolean {
  if (event.key !== "Enter" || event.ctrlKey || event.altKey || event.metaKey) return false;
  const spec = toolId ? measureSpecForToolId(toolId) : undefined;
  if (!spec || spec.kind === "length") return false;
  return !isEnterConsumer(event.target);
}
