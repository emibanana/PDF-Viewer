import { useEffect, useMemo } from "react";
import { useAnnotationCapability } from "@embedpdf/plugin-annotation/react";
import { useScrollCapability } from "@embedpdf/plugin-scroll/react";
import { useAllFiles } from "@editor/contexts/FileContext";
import { getFormFillFileId, isStirlingFile } from "@editor/types/fileContext";
import { registerMeasureTools } from "@editor/components/viewer/markups/measureTools";
import { bindMarkupController, disarmTool, isMeasureToolArmed } from "@editor/services/markups/markupController";
import { attachMarkupSync, attachMarkupUiSync } from "@editor/services/markups/markupSync";
import { getMarkupsUiState } from "@editor/services/markups/markupsUiStore";
import {
  aliasFileKey,
  getActiveFileKey,
  getPageScale,
  seedPageScalesFromFile,
  setActiveFileKey,
} from "@editor/services/markups/pageScaleStore";

/** Same shape as core's seam hook takes. */
export interface MarkupToolsSource {
  enabled: boolean;
  file: File | Blob | null | undefined;
}

/**
 * The key the open file's page scales are kept under: its lineage root, which stays the same
 * across saved versions, so a scale set before a save is still there after it.
 */
function useScaleFileKey(file: MarkupToolsSource["file"]): string | null {
  const { fileStubs } = useAllFiles();
  return useMemo(() => {
    if (!file) return null;
    if (!isStirlingFile(file)) return getFormFillFileId(file);
    const stub = fileStubs.find(({ id }) => id === file.fileId);
    return stub?.originalFileId ?? file.fileId;
  }, [file, fileStubs]);
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * Registers the six measurement tools, keeps `/Contents` in step with the geometry and page
 * scale, mirrors selection and the armed tool into the markups UI store, and binds the
 * controller the panels use. Esc disarms a measurement tool.
 */
export function useMarkupTools({ enabled, file }: MarkupToolsSource): void {
  const { provides: annotation } = useAnnotationCapability();
  const { provides: scroll } = useScrollCapability();
  const fileKey = useScaleFileKey(file);

  useEffect(() => {
    if (!enabled || !fileKey) return undefined;
    setActiveFileKey(fileKey);
    if (file && isStirlingFile(file)) aliasFileKey(file.fileId, fileKey);
    if (file) void seedPageScalesFromFile(fileKey, file);
    return () => setActiveFileKey(null);
  }, [enabled, fileKey, file]);

  useEffect(() => {
    if (!enabled || !annotation) return undefined;
    registerMeasureTools(annotation, (pageIndex) => getPageScale(getActiveFileKey(), pageIndex));
    const stopSync = attachMarkupSync(annotation);
    const stopUiSync = attachMarkupUiSync(annotation);
    bindMarkupController({ annotation, scroll: scroll ?? null });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isTypingTarget(event.target)) return;
      if (isMeasureToolArmed(getMarkupsUiState().armedToolId)) disarmTool();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      bindMarkupController(null);
      stopUiSync();
      stopSync();
    };
  }, [enabled, annotation, scroll, fileKey]);
}
