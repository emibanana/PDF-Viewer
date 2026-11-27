import { useSyncExternalStore } from "react";
import type { AnnotationCapability } from "@embedpdf/plugin-annotation";
import type { PdfAnnotationObject } from "@embedpdf/models";

/**
 * The annotation plugin as the right dock sees it. The dock is mounted outside the EmbedPDF
 * provider, so it cannot use the plugin's hooks: `useMarkupTools` binds the capability here and
 * the dock reads the selected annotation and the tools' defaults through it. Everything is empty
 * or a no-op while nothing is bound.
 */
let bound: AnnotationCapability | null = null;
let stopStateWatch: (() => void) | null = null;
let selected: PdfAnnotationObject | null = null;
const listeners = new Set<() => void>();

function setSelected(next: PdfAnnotationObject | null): void {
  if (next === selected) return;
  selected = next;
  for (const listener of [...listeners]) listener();
}

export function bindAnnotationBridge(api: AnnotationCapability | null): void {
  stopStateWatch?.();
  stopStateWatch = null;
  bound = api;
  if (!api) {
    setSelected(null);
    return;
  }
  const initial = api.getSelectedAnnotation();
  setSelected(initial && initial.commitState !== "deleted" ? initial.object : null);
  stopStateWatch =
    api.onStateChange(({ state }) => {
      const tracked = state.selectedUid ? state.byUid[state.selectedUid] : undefined;
      setSelected(tracked && tracked.commitState !== "deleted" ? tracked.object : null);
    }) ?? null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The selected annotation object; a new reference after every change to it, the same one otherwise. */
export function useSelectedAnnotation(): PdfAnnotationObject | null {
  return useSyncExternalStore(subscribe, () => selected);
}

/** The defaults the plugin gives new annotations of a tool, or null for an unknown tool. */
export function getPluginToolDefaults(toolId: string): Record<string, unknown> | null {
  const tool = bound?.getTool(toolId);
  return tool ? tool.defaults : null;
}

/** Merges `patch` into a tool's defaults, so the next markup drawn with it starts that way. */
export function setPluginToolDefaults(toolId: string, patch: Record<string, unknown>): void {
  if (!bound?.getTool(toolId)) return;
  bound.setToolDefaults(toolId, patch);
}
