import { useEffect, useRef } from "react";
import { useNavigationState } from "@editor/contexts/NavigationContext";

/**
 * Ctrl+S runs the same Save as the toolbar's download button, so a file opened from disk is
 * written back in place. Form Fill has its own Ctrl+S (it applies its field values first), and
 * the keystroke is left to it there.
 */
export function useCtrlSSave(save: () => Promise<void>, enabled: boolean) {
  const { selectedTool } = useNavigationState();
  const latest = useRef({ save, enabled, selectedTool });
  latest.current = { save, enabled, selectedTool };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "s") return;
      const { enabled: canSave, selectedTool: tool } = latest.current;
      if (tool === "formFill") return;
      event.preventDefault();
      if (event.repeat || !canSave) return;
      // A text box still being typed in commits on blur, which clicking the toolbar's Save
      // button does for free; do it here so the typed text is part of what is saved.
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) active.blur();
      window.setTimeout(() => void latest.current.save(), 500);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
