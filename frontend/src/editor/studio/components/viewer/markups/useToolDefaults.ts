import { useCallback, useState } from "react";
import { getPluginToolDefaults } from "@editor/services/markups/annotationBridge";
import type { MeasureToolSpec } from "@editor/services/markups/markupModel";
import {
  loadStoredToolDefaults,
  toolDefaultsFromPlugin,
  updateToolDefaults,
  type ToolDefaults,
} from "@editor/services/markups/toolDefaults";

function readToolDefaults(spec: MeasureToolSpec): ToolDefaults {
  const base = toolDefaultsFromPlugin(spec, getPluginToolDefaults(spec.id) ?? {});
  return { ...base, ...loadStoredToolDefaults()[spec.id] };
}

/**
 * The defaults a measurement tool gives new markups, for the Properties fields to edit. A
 * change is applied to the plugin tool at once and remembered in localStorage. Key the caller
 * by tool, so switching tools reads the other tool's values.
 */
export function useToolDefaults(spec: MeasureToolSpec) {
  const [values, setValues] = useState<ToolDefaults>(() => readToolDefaults(spec));

  const update = useCallback(
    (change: Partial<ToolDefaults>) => {
      setValues((previous) => ({ ...previous, ...change }));
      updateToolDefaults(spec, change);
    },
    [spec],
  );

  return { values, update };
}
