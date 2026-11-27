import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "@editor/ui/Icon";
import { BarButton } from "@editor/components/viewer/ViewerBarControls";
import { useIsPhone } from "@editor/hooks/useIsMobile";
import { useWorkbenchBarButtons, type WorkbenchBarButtonWithAction } from "@editor/hooks/useWorkbenchBarButtons";
import { toggleBottomDock, toggleRightDock, useMarkupsUi } from "@editor/services/markups/markupsUiStore";

/** Adds the "Measure / Properties" and "Markups List" toggles to the viewer bar. */
export function useMarkupBarButtons(): void {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const rightOpen = useMarkupsUi((state) => state.rightDockOpen);
  const bottomOpen = useMarkupsUi((state) => state.bottomDockOpen);
  const propertiesLabel = t("markups.bar.properties", "Measure / Properties");
  const listLabel = t("markups.bar.list", "Markups List");

  const buttons = useMemo<WorkbenchBarButtonWithAction[]>(() => {
    const section = isPhone ? ("top" as const) : ("page-bar" as const);
    const toggle = (
      id: string,
      icon: IconName,
      label: string,
      active: boolean,
      onToggle: () => void,
      order: number,
    ): WorkbenchBarButtonWithAction => ({
      id,
      tooltip: label,
      ariaLabel: label,
      section,
      order,
      active,
      icon: <Icon name={icon} size="1rem" />,
      onClick: onToggle,
      foldsIntoMenu: section === "page-bar",
      render: ({ disabled }) => (
        <BarButton
          icon={icon}
          label={label}
          iconOnly
          size={isPhone ? undefined : "sm"}
          tooltipPosition={isPhone ? undefined : "top"}
          active={active}
          disabled={disabled}
          onClick={onToggle}
          testId={id}
        />
      ),
    });
    return [
      toggle("viewer-markups-properties", "panel-right", propertiesLabel, rightOpen, toggleRightDock, 16),
      toggle("viewer-markups-list", "table-of-contents", listLabel, bottomOpen, toggleBottomDock, 17),
    ];
  }, [isPhone, rightOpen, bottomOpen, propertiesLabel, listLabel]);

  useWorkbenchBarButtons(buttons);
}
