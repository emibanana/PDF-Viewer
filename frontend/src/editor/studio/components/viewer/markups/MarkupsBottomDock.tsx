import { useTranslation } from "react-i18next";
import { ActionIcon } from "@editor/ui/ActionIcon";
import { Icon } from "@editor/ui/Icon";
import { getMarkupsUiState, setMarkupsUi, useMarkupsUi } from "@editor/services/markups/markupsUiStore";
import { useDockResize } from "@editor/components/viewer/markups/useDockResize";
import "@editor/components/viewer/markups/MarkupsDocks.css";

/** The Markups List dock under the pages. */
export function MarkupsBottomDock() {
  const { t } = useTranslation();
  const open = useMarkupsUi((state) => state.bottomDockOpen);
  const height = useMarkupsUi((state) => state.bottomDockHeight);
  const startResize = useDockResize(
    "y",
    -1,
    () => getMarkupsUiState().bottomDockHeight,
    (size) => setMarkupsUi({ bottomDockHeight: size }),
  );
  if (!open) return null;
  return (
    <section
      className="markups-dock markups-dock--bottom"
      style={{ height }}
      aria-label={t("markups.bar.list", "Markups List")}
      data-testid="markups-bottom-dock"
    >
      <div className="markups-dock__resize markups-dock__resize--vertical" onPointerDown={startResize} />
      <div className="markups-dock__header">
        <span className="markups-dock__title">{t("markups.bar.list", "Markups List")}</span>
        <ActionIcon
          variant="tertiary"
          size="sm"
          aria-label={t("common.close", "Close")}
          onClick={() => setMarkupsUi({ bottomDockOpen: false })}
        >
          <Icon name="x" size="1rem" />
        </ActionIcon>
      </div>
      <div className="markups-dock__body" />
    </section>
  );
}
