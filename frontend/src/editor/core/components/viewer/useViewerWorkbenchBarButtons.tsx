import { useMemo, useState, useEffect, useCallback } from "react";
import { Popover } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useViewer } from "@editor/contexts/ViewerContext";
import { useViewerPageTool } from "@editor/contexts/viewer/ViewerPageTool";
import {
  useWorkbenchBarButtons,
  WorkbenchBarButtonWithAction,
} from "@editor/hooks/useWorkbenchBarButtons";
import { Icon, type IconName } from "@editor/ui/Icon";
import { useIsPhone } from "@editor/hooks/useIsMobile";
import { BarButton } from "@editor/components/viewer/ViewerBarControls";
import { ViewerDocumentMenu } from "@editor/components/viewer/ViewerDocumentMenu";
import { ViewerPageViewMenu } from "@editor/components/viewer/ViewerPageViewMenu";
import { AnnotationVisibilityToggle } from "@editor/components/viewer/AnnotationVisibilityToggle";
import { SearchInterface } from "@editor/components/viewer/SearchInterface";
import ViewerAnnotationControls from "@editor/components/viewer/ViewerAnnotationControls";
import { useSidebarContext } from "@editor/contexts/SidebarContext";
import { useWorkbenchBarTooltipSide } from "@editor/hooks/useWorkbenchBarTooltipSide";
import { useToolWorkflow } from "@editor/contexts/ToolWorkflowContext";
import {
  useNavigationState,
  useNavigationGuard,
} from "@editor/contexts/NavigationContext";
import {
  useRedaction,
  useRedactionMode,
} from "@editor/contexts/RedactionContext";
import { RulerScaleSettingsButton } from "@editor/components/viewer/RulerScaleSettingsButton";
import type { MeasureScale } from "@editor/utils/measurementTypes";
import { useReviewMode } from "@editor/tools/pdfTextEditor/store/reviewMode";
import {
  useEditOrReview,
} from "@editor/tools/pdfTextEditor/hooks/useEditOrReview";

export function useViewerWorkbenchBarButtons(
  isRulerActive?: boolean,
  setIsRulerActive?: (v: boolean) => void,
  customScale?: MeasureScale | null,
  setCustomScale?: (scale: MeasureScale | null) => void,
  isScaleCalibrationActive?: boolean,
  startScaleCalibration?: () => void,
  cancelScaleCalibration?: () => void,
) {
  const { t, i18n } = useTranslation();
  const viewer = useViewer();
  const {
    isLayerSidebarVisible,
    hasLayers,
    isSearchInterfaceVisible,
    registerImmediatePanUpdate,
  } = viewer;
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const isPhone = useIsPhone();
  const { sidebarRefs } = useSidebarContext();
  const { position: tooltipPosition } = useWorkbenchBarTooltipSide(
    sidebarRefs,
    12,
  );
  const {
    handleToolSelect,
    handleToolSelectForced,
    handleBackToTools,
    clearToolSelection,
    setLeftPanelView,
    setReaderMode,
    toolRegistry,
  } = useToolWorkflow();
  const { selectedTool } = useNavigationState();
  const { requestNavigation } = useNavigationGuard();
  const { redactionsApplied, activeType: redactionActiveType } = useRedaction();
  const { pendingCount } = useRedactionMode();

  useEffect(() => {
    return registerImmediatePanUpdate((newIsPanning) => {
      setIsPanning(newIsPanning);
    });
  }, [registerImmediatePanUpdate]);

  // The tool the URL resolves to is the single source of truth: a separate
  // mirror drifts the moment the address changes without a popstate.
  const isAnnotationsActive = selectedTool === "annotate";

  const panLabel = t("workbenchBar.panMode", "Pan Mode");
  const applyRedactionsLabel = t(
    "workbenchBar.applyRedactionsFirst",
    "Apply redactions first",
  );
  const pageViewLabel = t("workbenchBar.pageView", "View");
  const annotationVisibilityLabel = t(
    "workbenchBar.toggleAnnotations",
    "Toggle Annotations Visibility",
  );
  const layersLabel = t("workbenchBar.layers", "Layers");
  const annotationsLabel = t("workbenchBar.annotate", "Annotate");
  const exitAnnotationsLabel = t(
    "workbenchBar.exitAnnotations",
    "Exit annotation mode",
  );
  const formFillLabel = t("workbenchBar.formFill", "Form Editor");
  const editTextLabel = t("workbenchBar.editText", "Edit Text");
  const { reviewing } = useReviewMode();
  const { startEditing } = useEditOrReview();
  const rulerLabel = t("workbenchBar.ruler", "Ruler / Measure");
  const rulerSettingsLabel = t("workbenchBar.rulerSettings", "Scale Settings");

  const isFormFillActive = (selectedTool as string) === "formFill";
  const isTextEditActive = selectedTool === "pdfTextEditor";
  const pageTool = useViewerPageTool();
  const pageToolActive = pageTool != null;
  // While a page tool with its own find is open, the search button opens that.
  const searchLabel = pageTool?.onToggleFind
    ? t("workbenchBar.findReplace", "Find & replace")
    : t("workbenchBar.search", "Search PDF");

  // The text editor owns the pages while it is open, so a viewer tool that
  // works on them closes it first, behind the unsaved-edits prompt. Leaving
  // without a second guard: the prompt has already settled the edits.
  const leaveTextEditThen = useCallback(
    (action: () => void) => {
      if (!isTextEditActive) {
        action();
        return;
      }
      requestNavigation(() => {
        setLeftPanelView("toolPicker");
        setReaderMode(false);
        clearToolSelection();
        action();
      });
    },
    [
      isTextEditActive,
      requestNavigation,
      setLeftPanelView,
      setReaderMode,
      clearToolSelection,
    ],
  );

  const preloadTextEditor = useCallback(
    () => void toolRegistry.pdfTextEditor?.preload?.(),
    [toolRegistry],
  );

  const handleStartScaleCalibration = useCallback(() => {
    startScaleCalibration?.();
    setIsRulerActive?.(true);
    if (isPanning) {
      viewer.panActions.disablePan();
    }
  }, [isPanning, setIsRulerActive, startScaleCalibration, viewer.panActions]);

  const handleCancelScaleCalibration = useCallback(() => {
    cancelScaleCalibration?.();
  }, [cancelScaleCalibration]);

  const handleApplyRulerScale = useCallback(
    (scale: MeasureScale) => {
      setCustomScale?.(scale);
    },
    [setCustomScale],
  );

  const handleResetRulerScale = useCallback(() => {
    setCustomScale?.(null);
  }, [setCustomScale]);

  const viewerButtons = useMemo<WorkbenchBarButtonWithAction[]>(() => {
    const panRedactionBlocked =
      !isPanning && pendingCount > 0 && redactionActiveType !== null;
    // Search, pan, measure and read aloud work through the document in view,
    // so they sit in the page bar below it. The side panels and how the pages
    // are shown get a menu each, and the modes that work on the pages are
    // named. A phone's page bar has no room, so there they join the tool row.
    const pageSection = isPhone ? ("top" as const) : ("page-bar" as const);
    const pageTooltip = isPhone ? tooltipPosition : ("top" as const);
    const pageButtonSize = isPhone ? undefined : ("sm" as const);
    // A narrow page bar folds these into a menu, which acts through the
    // registered action and shows the registered icon.
    const foldsIntoMenu = pageSection === "page-bar";
    const togglePan = () =>
      leaveTextEditThen(() => {
        viewer.panActions.togglePan();
        if (!isPanning && isRulerActive) setIsRulerActive?.(false);
      });
    const toggleRuler = () =>
      leaveTextEditThen(() => {
        const next = !isRulerActive;
        setIsRulerActive?.(next);
        if (next && isPanning) {
          viewer.panActions.disablePan();
        }
      });
    const panelToggle = (
      id: string,
      icon: IconName,
      label: string,
      active: boolean,
      onToggle: () => void,
      section: "row-start" | "row-end",
      order: number,
    ): WorkbenchBarButtonWithAction => ({
      id,
      tooltip: label,
      ariaLabel: label,
      section,
      order,
      active,
      onClick: onToggle,
      render: ({ disabled }) => (
        <BarButton
          icon={icon}
          label={label}
          iconOnly
          tooltipPosition={tooltipPosition}
          active={active}
          disabled={disabled}
          onClick={onToggle}
          testId={id}
        />
      ),
    });

    const buttons: WorkbenchBarButtonWithAction[] = [
      {
        id: "viewer-search",
        tooltip: searchLabel,
        ariaLabel: searchLabel,
        section: pageSection,
        order: 10,
        render: ({ disabled }) => (
          <Popover
            position={isPhone ? "bottom-end" : "top"}
            withArrow
            shadow="md"
            offset={8}
            opened={isSearchInterfaceVisible}
            onClose={viewer.searchInterfaceActions.close}
          >
            <Popover.Target>
              <BarButton
                icon="file-search"
                label={searchLabel}
                iconOnly
                size={pageButtonSize}
                tooltipPosition={pageTooltip}
                disabled={disabled}
                onClick={() =>
                  pageTool?.onToggleFind
                    ? pageTool.onToggleFind()
                    : leaveTextEditThen(viewer.searchInterfaceActions.toggle)
                }
              />
            </Popover.Target>
            <Popover.Dropdown>
              <div style={{ minWidth: "20rem" }}>
                <SearchInterface
                  visible={isSearchInterfaceVisible}
                  onClose={viewer.searchInterfaceActions.close}
                />
              </div>
            </Popover.Dropdown>
          </Popover>
        ),
      },
      {
        id: "viewer-pan-mode",
        tooltip: panRedactionBlocked ? applyRedactionsLabel : panLabel,
        ariaLabel: panRedactionBlocked ? applyRedactionsLabel : panLabel,
        section: pageSection,
        order: 12,
        active: isPanning,
        icon: <Icon name="hand" size="1rem" />,
        disabled: panRedactionBlocked,
        onClick: togglePan,
        foldsIntoMenu,
        render: ({ disabled }) => (
          <BarButton
            icon="hand"
            label={panRedactionBlocked ? applyRedactionsLabel : panLabel}
            iconOnly
            size={pageButtonSize}
            tooltipPosition={pageTooltip}
            active={isPanning}
            disabled={disabled || panRedactionBlocked}
            onClick={togglePan}
          />
        ),
      },
      {
        id: "viewer-ruler",
        tooltip: rulerLabel,
        ariaLabel: rulerLabel,
        section: pageSection,
        order: 14,
        active: Boolean(isRulerActive),
        icon: <Icon name="ruler" size="1rem" />,
        onClick: toggleRuler,
        foldsIntoMenu,
        render: ({ disabled }) => (
          <BarButton
            icon="ruler"
            label={rulerLabel}
            iconOnly
            size={pageButtonSize}
            tooltipPosition={pageTooltip}
            active={Boolean(isRulerActive)}
            disabled={disabled}
            onClick={toggleRuler}
          />
        ),
      },
      // Bookmarks, comments and attachments live in the reader's left panel, picked
      // from the quick-nav rail, rather than as toggles in this row.
      ...(hasLayers
        ? [
            panelToggle(
              "viewer-toggle-layers",
              "layers",
              layersLabel,
              isLayerSidebarVisible,
              viewer.toggleLayerSidebar,
              "row-start",
              4,
            ),
          ]
        : []),
      {
        id: "viewer-page-view",
        tooltip: pageViewLabel,
        ariaLabel: pageViewLabel,
        section: "top" as const,
        order: 21,
        render: ({ disabled }) => <ViewerPageViewMenu disabled={disabled} />,
      },
      {
        id: "viewer-annotation-visibility",
        tooltip: annotationVisibilityLabel,
        ariaLabel: annotationVisibilityLabel,
        section: pageSection,
        order: 18,
        render: ({ disabled }) => (
          <AnnotationVisibilityToggle
            disabled={disabled}
            size={pageButtonSize}
          />
        ),
      },
      // Scale settings belong to the ruler, so they sit beside it while it is
      // on. They don't fold, so a narrow bar keeps them next to the Tools menu.
      ...(isRulerActive
        ? [
            {
              id: "viewer-ruler-settings",
              tooltip: rulerSettingsLabel,
              ariaLabel: rulerSettingsLabel,
              section: pageSection,
              order: 15,
              render: ({ disabled }: { disabled?: boolean }) => (
                <RulerScaleSettingsButton
                  disabled={disabled}
                  label={rulerSettingsLabel}
                  tooltipPosition={pageTooltip}
                  currentScale={customScale}
                  onApplyScale={handleApplyRulerScale}
                  onResetScale={handleResetRulerScale}
                  onStartCalibration={handleStartScaleCalibration}
                  onCancelCalibration={handleCancelScaleCalibration}
                  isCalibrationActive={isScaleCalibrationActive}
                />
              ),
            },
          ]
        : []),
      {
        id: "viewer-edit-text",
        tooltip: editTextLabel,
        ariaLabel: editTextLabel,
        section: "middle" as const,
        order: 50,
        render: ({ disabled }) => (
          <BarButton
            icon="square-pen"
            label={editTextLabel}
            tooltipPosition={tooltipPosition}
            active={isTextEditActive}
            disabled={disabled}
            onClick={() =>
              isTextEditActive
                ? handleBackToTools()
                : reviewing
                  ? startEditing()
                  : handleToolSelect("pdfTextEditor")
            }
            onPointerEnter={preloadTextEditor}
            onFocus={preloadTextEditor}
            testId="viewer-edit-text"
          />
        ),
      },
      {
        id: "viewer-annotations",
        tooltip: isAnnotationsActive ? exitAnnotationsLabel : annotationsLabel,
        ariaLabel: isAnnotationsActive
          ? exitAnnotationsLabel
          : annotationsLabel,
        section: "middle" as const,
        order: 51,
        active: isAnnotationsActive,
        render: ({ disabled }) => (
          <BarButton
            icon="pencil"
            label={annotationsLabel}
            hint={isAnnotationsActive ? exitAnnotationsLabel : undefined}
            tooltipPosition={tooltipPosition}
            active={isAnnotationsActive}
            disabled={disabled}
            onClick={() => {
              if (isAnnotationsActive) {
                // The tool's own exit path, so pending annotations get the
                // same save warning Form Editor has always shown.
                handleBackToTools();
                return;
              }
              if (pendingCount > 0 || redactionsApplied) {
                // The redaction warning answers the save question, so the
                // forced selection here avoids a second modal.
                requestNavigation(() => handleToolSelectForced("annotate"));
              } else {
                handleToolSelect("annotate");
              }
            }}
            testId="annotations-toggle"
          />
        ),
      },
      {
        id: "viewer-annotation-controls",
        section: "middle" as const,
        order: 52,
        render: ({ disabled }) => (
          <ViewerAnnotationControls
            currentView="viewer"
            disabled={disabled}
            tooltipPosition={tooltipPosition}
          />
        ),
      },
      {
        id: "viewer-form-fill",
        tooltip: formFillLabel,
        ariaLabel: formFillLabel,
        section: "middle" as const,
        order: 53,
        render: ({ disabled }) => (
          <BarButton
            icon="clipboard-pen-line"
            label={formFillLabel}
            tooltipPosition={tooltipPosition}
            active={isFormFillActive}
            disabled={disabled}
            onClick={() =>
              isFormFillActive
                ? handleBackToTools()
                : handleToolSelect("formFill")
            }
          />
        ),
      },
      {
        id: "viewer-doc-menu",
        section: "row-end" as const,
        order: 60,
        render: ({ disabled }) => <ViewerDocumentMenu disabled={disabled} />,
      },
      // Not drawn in the bar, where the page bar holds them; registered for
      // reading mode's rail, which acts on them by id.
      ...(
        [
          {
            id: "viewer-rotate-left",
            disabled: pageToolActive,
            onClick: () => viewer.rotationActions.rotateBackward(),
          },
          {
            id: "viewer-rotate-right",
            disabled: pageToolActive,
            onClick: () => viewer.rotationActions.rotateForward(),
          },
        ] satisfies WorkbenchBarButtonWithAction[]
      ).map((button) => ({ ...button, visible: false })),
    ];

    return buttons;
  }, [
    t,
    i18n.language,
    viewer,
    isLayerSidebarVisible,
    hasLayers,
    isSearchInterfaceVisible,
    isPanning,
    searchLabel,
    panLabel,
    applyRedactionsLabel,
    layersLabel,
    isPhone,
    pageViewLabel,
    annotationVisibilityLabel,
    preloadTextEditor,
    tooltipPosition,
    annotationsLabel,
    exitAnnotationsLabel,
    isAnnotationsActive,
    handleToolSelect,
    handleToolSelectForced,
    handleBackToTools,
    requestNavigation,
    redactionsApplied,
    pendingCount,
    redactionActiveType,
    formFillLabel,
    isFormFillActive,
    editTextLabel,
    reviewing,
    startEditing,
    isTextEditActive,
    pageTool,
    pageToolActive,
    leaveTextEditThen,
    rulerLabel,
    rulerSettingsLabel,
    isRulerActive,
    setIsRulerActive,
    handleStartScaleCalibration,
    handleCancelScaleCalibration,
    handleApplyRulerScale,
    handleResetRulerScale,
    customScale,
    isScaleCalibrationActive,
  ]);

  useWorkbenchBarButtons(viewerButtons);
}
