import { useTranslation } from "react-i18next";
import { Icon } from "@editor/ui/Icon";
import type { QuickNavEntry } from "@editor/components/shared/quickNav/QuickNavRailBase";
import { selectReaderNavTab, useReaderNav } from "@editor/utils/readerNavStore";
import { toggleBottomDock, useMarkupsUi } from "@editor/services/markups/markupsUiStore";

const SIZE = "1.125rem";

/**
 * The two markup entries of the left rail: Measure opens its panel in the left panel, and
 * Markups List shows or hides the list under the pages.
 */
export function useMarkupRailEntries(): QuickNavEntry[] {
  const { t } = useTranslation();
  const readerNav = useReaderNav();
  const listOpen = useMarkupsUi((state) => state.bottomDockOpen);
  return [
    {
      id: "markups-measure",
      label: t("markups.bar.properties", "Measure"),
      icon: <Icon name="ruler" size={SIZE} />,
      current: readerNav.open && readerNav.tab === "measure",
      testId: "markups-measure-rail",
      onClick: () => selectReaderNavTab("measure"),
    },
    {
      id: "markups-list",
      label: t("markups.bar.list", "Markups List"),
      icon: <Icon name="table-of-contents" size={SIZE} />,
      pressed: listOpen,
      testId: "markups-list-rail",
      onClick: toggleBottomDock,
    },
  ];
}
