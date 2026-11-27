import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@editor/ui/Icon";
import { BarButton } from "@editor/components/viewer/ViewerBarControls";
import { useIsPhone } from "@editor/hooks/useIsMobile";
import { useWorkbenchBarButtons, type WorkbenchBarButtonWithAction } from "@editor/hooks/useWorkbenchBarButtons";
import { toggleMeasureLabels, useMarkupsUi } from "@editor/services/markups/markupsUiStore";

/** Adds the toggle for the value pills on measurement markups to the viewer bar. */
export function useMarkupBarButtons(): void {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const showLabels = useMarkupsUi((state) => state.showMeasureLabels);
  const label = t("markups.bar.labels", "Measurement labels");

  const buttons = useMemo<WorkbenchBarButtonWithAction[]>(() => {
    const section = isPhone ? ("top" as const) : ("page-bar" as const);
    return [
      {
        id: "viewer-measure-labels",
        tooltip: label,
        ariaLabel: label,
        section,
        order: 16,
        active: showLabels,
        icon: <Icon name="tag" size="1rem" />,
        onClick: toggleMeasureLabels,
        foldsIntoMenu: section === "page-bar",
        render: ({ disabled }) => (
          <BarButton
            icon="tag"
            label={label}
            iconOnly
            size={isPhone ? undefined : "sm"}
            tooltipPosition={isPhone ? undefined : "top"}
            active={showLabels}
            disabled={disabled}
            onClick={toggleMeasureLabels}
            testId="viewer-measure-labels"
          />
        ),
      },
    ];
  }, [isPhone, showLabels, label]);

  useWorkbenchBarButtons(buttons);
}
