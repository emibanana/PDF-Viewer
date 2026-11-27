import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  columnResizingFeature,
  columnSizingFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  functionalUpdate,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnDef,
  type Updater,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAllFiles } from "@editor/contexts/FileContext";
import { useViewer } from "@editor/contexts/ViewerContext";
import { Icon, type IconName } from "@editor/ui/Icon";
import { Dropdown } from "@editor/ui/Dropdown";
import {
  deleteMarkups,
  getMarkupSelection,
  listAnnotations,
  selectMarkup,
  setMarkupSelection,
  subscribeMarkupAnnotations,
  toggleMarkupSelection,
  updateMarkups,
} from "@editor/services/markups/markupController";
import {
  MARKUP_COLUMNS,
  columnDisplayText,
  columnSortValue,
  isMarkupColumnId,
  loadMarkupListLayout,
  saveMarkupListLayout,
  visibleColumnIds,
  type MarkupColumnId,
  type MarkupColumnSpec,
  type MarkupListLayout,
} from "@editor/services/markups/markupColumns";
import { buildMarkupsCsv, defaultCsvFileName } from "@editor/services/markups/csvExport";
import { saveCsvFile } from "@editor/services/markups/csvSave";
import {
  MARKUP_STATUSES,
  MIXED_UNITS,
  computeTotals,
  facetValue,
  facetValues,
  filterByFacets,
  filterByText,
  groupBySubject,
  withMarkupStatus,
  type MarkupGroup,
  type MarkupRow,
  type MarkupTotals,
  type MarkupTypeId,
  type RowFacet,
  type RowFacetFilter,
} from "@editor/services/markups/markupRows";
import { formatNumber } from "@editor/services/markups/measureMath";
import { setMarkupsUi, useMarkupsUi } from "@editor/services/markups/markupsUiStore";
import { useMarkupRows, useMarkupTextFormat } from "@editor/services/markups/useMarkupRows";
import { MarkupsListToolbar, type FacetOptions } from "@editor/components/viewer/markups/MarkupsListToolbar";
import "@editor/components/viewer/markups/MarkupsList.css";

const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 26;
const MAX_COLUMN_WIDTH = 800;
const LAYOUT_SAVE_DELAY_MS = 250;
const NOTICE_DURATION_MS = 5000;
const NO_VALUE = "—";
const SAFE_COLOUR = /^#[0-9a-f]{3,8}$/i;

const TABLE_FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});
type Features = typeof TABLE_FEATURES;

const EMPTY_FILTERS: RowFacetFilter = {};

type ListItem =
  | { kind: "group"; key: string; group: MarkupGroup; collapsed: boolean }
  | { kind: "row"; key: string; row: MarkupRow };

function buildItems(groups: MarkupGroup[] | null, rows: MarkupRow[], collapsed: ReadonlySet<string>): ListItem[] {
  if (!groups) return rows.map((row) => ({ kind: "row", key: row.id, row }));
  const items: ListItem[] = [];
  for (const group of groups) {
    const isCollapsed = collapsed.has(group.key);
    items.push({ kind: "group", key: `group:${group.key}`, group, collapsed: isCollapsed });
    if (!isCollapsed) for (const row of group.rows) items.push({ kind: "row", key: row.id, row });
  }
  return items;
}

const TYPE_ICONS: Record<MarkupTypeId, IconName> = {
  length: "ruler",
  polylength: "polyline",
  curve: "spline",
  area: "square-dashed",
  wall: "rows-2",
  volume: "boxes",
  note: "sticky-note",
  textBox: "type",
  line: "minus",
  polyline: "polyline",
  polygon: "diamond",
  rectangle: "square",
  ellipse: "circle",
  highlight: "highlighter",
  underline: "underline",
  squiggly: "line-squiggle",
  strikeout: "strikethrough",
  stamp: "stamp",
  caret: "chevron-up",
  ink: "pencil",
  redaction: "redact",
  attachment: "paperclip",
  other: "shapes",
};

function MarkupTypeIcon({ type }: { type: MarkupTypeId }) {
  return (
    <span className="markups-list__icon">
      <Icon name={TYPE_ICONS[type]} size="0.85rem" />
    </span>
  );
}

function cellClass(spec: MarkupColumnSpec, extra = ""): string {
  return `markups-list__cell${spec.kind === "number" ? " markups-list__cell--number" : ""}${extra}`;
}

function totalText(totals: MarkupTotals, spec: MarkupColumnSpec): string {
  if (spec.id === "unit") return totals.unit === MIXED_UNITS ? NO_VALUE : (totals.unit ?? "");
  if (!spec.total) return "";
  const sum = totals.sums[spec.total];
  if (sum === null) return "";
  return sum === MIXED_UNITS ? NO_VALUE : formatNumber(sum.value, totals.precision);
}

function StatusCell({
  row,
  statusName,
  onChange,
}: {
  row: MarkupRow;
  statusName: (status: string) => string;
  onChange: (row: MarkupRow, status: string) => void;
}) {
  const { t } = useTranslation();
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  return (
    // The dropdown menu is portalled but still bubbles through React, so the wrapper keeps its clicks off the row.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <span onClick={stop} onDoubleClick={stop} onKeyDown={stop} onMouseDown={stop}>
      <Dropdown.Root align="start">
        <Dropdown.Trigger>
          <button type="button" className="markups-list__status">
            <span>{row.status === "" ? NO_VALUE : statusName(row.status)}</span>
            <Icon name="chevron-down" size="0.7rem" />
          </button>
        </Dropdown.Trigger>
        <Dropdown.Menu width={140}>
          {["", ...MARKUP_STATUSES].map((status) => (
            <Dropdown.Item key={status} active={status === row.status} onSelect={() => onChange(row, status)}>
              {status === "" ? t("markups.list.status.none", "None") : statusName(status)}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Root>
    </span>
  );
}

function sortGlyph(direction: false | "asc" | "desc"): string {
  if (direction === "asc") return "▲";
  if (direction === "desc") return "▼";
  return "";
}

/**
 * The grid of the Markups List: every annotation of the open document, with sorting,
 * grouping by subject, subtotals, column layout, filtering, selection that follows the viewer,
 * status editing, delete and CSV export. Selection lives in the annotation plugin, so the list
 * and the pages always agree on what is selected.
 */
export function MarkupsList({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const format = useMarkupTextFormat();
  const allRows = useMarkupRows();
  const { activeFileId } = useViewer();
  const { fileStubs } = useAllFiles();
  const fileName = fileStubs.find((stub) => stub.id === activeFileId)?.name;

  const [layout, setLayout] = useState<MarkupListLayout>(loadMarkupListLayout);
  const [query, setQuery] = useState("");
  const [facets, setFacets] = useState<RowFacetFilter>(EMPTY_FILTERS);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => saveMarkupListLayout(layout), LAYOUT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [layout]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const selection = useSyncExternalStore(subscribeMarkupAnnotations, getMarkupSelection);
  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const focusedId = useMarkupsUi((state) => state.selectedAnnotationId);

  const visibleIds = useMemo(() => visibleColumnIds(layout), [layout]);

  const filteredRows = useMemo(() => {
    const byFacets = filterByFacets(allRows, facets);
    return filterByText(byFacets, query, (row) => visibleIds.map((id) => columnDisplayText(row, id, format)));
  }, [allRows, facets, query, visibleIds, format]);

  const columns = useMemo<ColumnDef<Features, MarkupRow>[]>(() => {
    const helper = createColumnHelper<Features, MarkupRow>();
    return MARKUP_COLUMNS.map((spec) =>
      helper.accessor((row: MarkupRow): unknown => columnSortValue(row, spec.id) ?? undefined, {
        id: spec.id,
        header: t(spec.labelKey, spec.defaultLabel),
        size: spec.width,
        minSize: spec.minWidth,
        maxSize: MAX_COLUMN_WIDTH,
        sortUndefined: "last",
        sortFn: spec.kind === "number" || spec.kind === "date" ? "basic" : "alphanumeric",
      }),
    );
  }, [t]);

  const tableState = useMemo(
    () => ({
      sorting: layout.sorting,
      columnOrder: layout.order,
      columnVisibility: Object.fromEntries(layout.hidden.map((id) => [id, false])),
      columnSizing: layout.widths as Record<string, number>,
    }),
    [layout],
  );

  const table = useTable({
    features: TABLE_FEATURES,
    columns,
    data: filteredRows,
    getRowId: (row) => row.id,
    state: tableState,
    columnResizeMode: "onChange",
    onSortingChange: (updater: Updater<{ id: string; desc: boolean }[]>) =>
      setLayout((previous) => ({
        ...previous,
        sorting: functionalUpdate(updater, previous.sorting).flatMap((entry) =>
          isMarkupColumnId(entry.id) ? [{ id: entry.id, desc: entry.desc }] : [],
        ),
      })),
    onColumnSizingChange: (updater: Updater<Record<string, number>>) =>
      setLayout((previous) => {
        const next = functionalUpdate(updater, previous.widths as Record<string, number>);
        const widths: MarkupListLayout["widths"] = {};
        for (const [id, width] of Object.entries(next)) if (isMarkupColumnId(id)) widths[id] = Math.round(width);
        return { ...previous, widths };
      }),
  });

  const sortedModelRows = table.getRowModel().rows;
  const sortedRows = useMemo(() => sortedModelRows.map((row) => row.original), [sortedModelRows]);
  const sizeById = new Map(table.getVisibleLeafColumns().map((column) => [column.id, column.getSize()]));
  const subjectDescending = layout.sorting[0]?.id === "subject" && layout.sorting[0].desc;
  const groups = useMemo(
    () => (layout.groupBySubject ? groupBySubject(sortedRows, subjectDescending) : null),
    [layout.groupBySubject, subjectDescending, sortedRows],
  );
  const grandTotals = useMemo(() => computeTotals(sortedRows), [sortedRows]);
  const items = useMemo(() => buildItems(groups, sortedRows, collapsed), [groups, sortedRows, collapsed]);
  const allCollapsed = !!groups && groups.length > 0 && groups.every((group) => collapsed.has(group.key));

  const scrollerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => items[index].key,
    overscan: 12,
    scrollMargin: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
    scrollPaddingEnd: HEADER_HEIGHT,
  });

  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!focusedId) {
      scrolledFor.current = null;
      return;
    }
    if (scrolledFor.current === focusedId) return;
    const row = allRows.find((candidate) => candidate.id === focusedId);
    if (!row) return;
    if (groups && collapsed.has(row.subject.toLowerCase())) {
      setCollapsed((previous) => {
        const next = new Set(previous);
        next.delete(row.subject.toLowerCase());
        return next;
      });
      return;
    }
    const index = items.findIndex((item) => item.kind === "row" && item.row.id === focusedId);
    if (index < 0) return;
    virtualizer.scrollToIndex(index, { align: "auto" });
    scrolledFor.current = focusedId;
  }, [focusedId, allRows, groups, collapsed, items, virtualizer]);

  const dataRows = useMemo(() => items.flatMap((item) => (item.kind === "row" ? [item.row] : [])), [items]);
  const anchorRef = useRef<string | null>(null);
  const selectedRows = useMemo(() => filteredRows.filter((row) => selectedSet.has(row.id)), [filteredRows, selectedSet]);
  const selectionHidden = selectedRows.length > 0 && selectedRows.every((row) => row.hidden);

  const facetOptions = useMemo<FacetOptions>(() => {
    const options = (facet: RowFacet) => {
      const samples = new Map<string, { row: MarkupRow; count: number }>();
      for (const row of allRows) {
        const value = facetValue(row, facet);
        const entry = samples.get(value);
        if (entry) entry.count++;
        else samples.set(value, { row, count: 1 });
      }
      return facetValues(allRows, facet).map((value) => {
        const { row: sample, count } = samples.get(value) as { row: MarkupRow; count: number };
        let label = value;
        if (facet === "type") label = format.typeName(sample);
        else if (facet === "page") label = t("markups.list.pageNumber", "Page {{page}}", { page: sample.pageLabel });
        else if (facet === "author" && value === "") label = t("markups.list.noAuthor", "(no author)");
        else if (facet === "status") label = value === "" ? t("markups.list.status.none", "None") : format.statusName(value);
        return { value, label, count };
      });
    };
    return { type: options("type"), page: options("page"), author: options("author"), status: options("status") };
  }, [allRows, format, t]);

  const selectRow = (event: MouseEvent, row: MarkupRow) => {
    if (event.shiftKey && anchorRef.current) {
      const from = dataRows.findIndex((candidate) => candidate.id === anchorRef.current);
      const to = dataRows.findIndex((candidate) => candidate.id === row.id);
      if (from >= 0 && to >= 0) {
        const [start, end] = from < to ? [from, to] : [to, from];
        setMarkupSelection(dataRows.slice(start, end + 1).map((candidate) => candidate.id));
        return;
      }
    }
    anchorRef.current = row.id;
    if (event.ctrlKey || event.metaKey) toggleMarkupSelection(row.pageIndex, row.id);
    else selectMarkup(row.pageIndex, row.id, { scroll: true });
  };

  const patchRows = (
    targets: readonly MarkupRow[],
    patchFor: (annotation: Record<string, unknown>) => Record<string, unknown>,
  ) => {
    const byId = new Map(
      listAnnotations().map((tracked) => [tracked.object.id, tracked.object as unknown as Record<string, unknown>]),
    );
    updateMarkups(
      targets.flatMap((row) => {
        const annotation = byId.get(row.id);
        return annotation ? [{ pageIndex: row.pageIndex, id: row.id, patch: patchFor(annotation) }] : [];
      }),
    );
  };

  const changeStatus = (row: MarkupRow, status: string) => {
    const targets = selectedSet.has(row.id) ? selectedRows : [row];
    patchRows(targets, (annotation) => ({ custom: withMarkupStatus(annotation.custom, status) }));
  };

  const toggleSelectionHidden = () => {
    const hide = !selectionHidden;
    patchRows(selectedRows, (annotation) => {
      const flags = ((annotation.flags as string[] | undefined) ?? []).filter(
        (flag) => flag !== "hidden" && flag !== "noView",
      );
      return { flags: hide ? [...flags, "hidden"] : flags };
    });
  };

  const deleteSelection = () => deleteMarkups(selectedRows.map((row) => ({ pageIndex: row.pageIndex, id: row.id })));

  const exportCsv = async () => {
    const csv = buildMarkupsCsv({
      columns: visibleIds.map((id) => {
        const spec = MARKUP_COLUMNS.find((column) => column.id === id) as MarkupColumnSpec;
        return { id, header: t(spec.labelKey, spec.defaultLabel) };
      }),
      rows: sortedRows,
      groupBySubject: layout.groupBySubject,
      subjectDescending,
      format,
      labels: {
        rowType: t("markups.list.csv.rowType", "Row type"),
        markup: t("markups.list.csv.markup", "Markup"),
        subtotal: t("markups.list.csv.subtotal", "Subtotal"),
        total: t("markups.list.csv.total", "Total"),
        group: t("markups.list.csv.group", "Group"),
        mixedUnits: t("markups.list.csv.mixedUnits", "mixed"),
      },
    });
    try {
      const result = await saveCsvFile(csv, defaultCsvFileName(fileName, t("markups.list.csv.fileSuffix", "Markups")));
      setNotice(result.status === "saved" ? t("markups.list.csv.saved", "Markups List exported.") : null);
    } catch (error) {
      setNotice(
        t("markups.list.csv.failed", "Could not save the CSV file: {{message}}", {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };

  const moveSelection = (step: -1 | 1) => {
    if (dataRows.length === 0) return;
    const current = dataRows.findIndex((row) => row.id === (focusedId ?? selection[selection.length - 1]));
    const next = dataRows[Math.min(dataRows.length - 1, Math.max(0, current < 0 ? 0 : current + step))];
    anchorRef.current = next.id;
    selectMarkup(next.pageIndex, next.id, { scroll: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName)) return;
    if (event.key === "Delete" && selectedRows.length > 0) {
      deleteSelection();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      moveSelection(event.key === "ArrowDown" ? 1 : -1);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      setMarkupSelection(dataRows.map((row) => row.id));
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const toggleCollapsed = () => setCollapsed(allCollapsed || !groups ? new Set() : new Set(groups.map((group) => group.key)));

  const renderCell = (spec: MarkupColumnSpec, row: MarkupRow, isFirst: boolean) => {
    const text = columnDisplayText(row, spec.id, format);
    switch (spec.kind) {
      case "colour":
        return SAFE_COLOUR.test(row.colour) ? (
          <span className="markups-list__swatch" style={{ background: row.colour }} title={row.colour} />
        ) : null;
      case "status":
        return <StatusCell row={row} statusName={format.statusName} onChange={changeStatus} />;
      default:
        return (
          <>
            {isFirst && layout.groupBySubject && <span className="markups-list__indent" />}
            {spec.id === "subject" && <MarkupTypeIcon type={row.type} />}
            <span title={text}>{text}</span>
          </>
        );
    }
  };

  const resizingRef = useRef(false);
  /** A drag that ends over the header would otherwise also count as a click and re-sort the column. */
  const startResize = (handler: (event: unknown) => void, event: unknown) => {
    resizingRef.current = true;
    const end = () => setTimeout(() => (resizingRef.current = false), 0);
    window.addEventListener("mouseup", end, { once: true });
    window.addEventListener("touchend", end, { once: true });
    handler(event);
  };

  const columnWidth = (id: string) => sizeById.get(id) ?? 100;
  const totalWidth = [...sizeById.values()].reduce((sum, width) => sum + width, 0);
  const specOf = (id: string) => MARKUP_COLUMNS.find((spec) => spec.id === id) as MarkupColumnSpec;
  const firstColumnId: MarkupColumnId | undefined = visibleIds[0];
  const headers = table.getHeaderGroups()[0]?.headers ?? [];

  // data-no-interaction: the viewer deselects on any pointer-down outside the page unless told
  // otherwise, which would turn a Ctrl-click in the list into a plain click.
  return (
    <div className="markups-list" data-no-interaction>
      <MarkupsListToolbar
        shownCount={filteredRows.length}
        totalCount={allRows.length}
        query={query}
        onQueryChange={setQuery}
        facetOptions={facetOptions}
        facets={facets}
        onFacetsChange={setFacets}
        grouped={layout.groupBySubject}
        onToggleGrouped={() => setLayout({ ...layout, groupBySubject: !layout.groupBySubject })}
        allCollapsed={allCollapsed}
        onToggleCollapsed={toggleCollapsed}
        layout={layout}
        onLayoutChange={setLayout}
        selectedCount={selectedRows.length}
        selectionHidden={selectionHidden}
        onToggleHidden={toggleSelectionHidden}
        onDelete={deleteSelection}
        onExport={() => void exportCsv()}
        onClose={onClose}
      />
      <div
        ref={scrollerRef}
        className="markups-list__scroller"
        role="grid"
        aria-label={t("markups.bar.list", "Markups List")}
        aria-rowcount={items.length}
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={
          { "--markups-row-height": `${ROW_HEIGHT}px`, "--markups-header-height": `${HEADER_HEIGHT}px` } as React.CSSProperties
        }
      >
        <div className="markups-list__inner" style={{ width: Math.max(totalWidth, 1) }}>
          <div className="markups-list__line markups-list__head" role="row">
            {headers.map((header) => {
              const spec = specOf(header.column.id);
              const direction = header.column.getIsSorted();
              return (
                <div
                  key={header.id}
                  role="columnheader"
                  aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
                  className={cellClass(spec)}
                  style={{ width: header.getSize() }}
                  onClick={(event) => {
                    if (!resizingRef.current) header.column.getToggleSortingHandler()?.(event);
                  }}
                >
                  <span>{t(spec.labelKey, spec.defaultLabel)}</span>
                  <span className="markups-list__sort">{sortGlyph(direction)}</span>
                  <div
                    className={`markups-list__resizer${header.column.getIsResizing() ? " is-resizing" : ""}`}
                    onMouseDown={(event) => startResize(header.getResizeHandler(), event)}
                    onTouchStart={(event) => startResize(header.getResizeHandler(), event)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
              );
            })}
          </div>
          <div className="markups-list__body" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = items[virtualItem.index];
              const style = { width: "100%", transform: `translateY(${virtualItem.start - HEADER_HEIGHT}px)` };
              if (item.kind === "group") {
                const { group } = item;
                return (
                  <div
                    key={item.key}
                    role="row"
                    aria-expanded={!item.collapsed}
                    className="markups-list__line markups-list__row is-group"
                    style={style}
                    onClick={() =>
                      setCollapsed((previous) => {
                        const next = new Set(previous);
                        if (next.has(group.key)) next.delete(group.key);
                        else next.add(group.key);
                        return next;
                      })
                    }
                  >
                    {visibleIds.map((id) => {
                      const spec = specOf(id);
                      const isFirst = id === firstColumnId;
                      return (
                        <div
                          key={id}
                          role="gridcell"
                          className={cellClass(spec, isFirst ? " markups-list__cell--overflow" : "")}
                          style={{ width: columnWidth(id) }}
                        >
                          {isFirst ? (
                            <>
                              <span className="markups-list__chevron">
                                <Icon name={item.collapsed ? "chevron-right" : "chevron-down"} size="0.8rem" />
                              </span>
                              <span>{`${group.subject} (${group.rows.length})`}</span>
                            </>
                          ) : (
                            <span>{totalText(group.totals, spec)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }
              const { row } = item;
              return (
                <div
                  key={item.key}
                  role="row"
                  aria-selected={selectedSet.has(row.id)}
                  className={`markups-list__line markups-list__row${selectedSet.has(row.id) ? " is-selected" : ""}${row.hidden ? " is-hidden" : ""}`}
                  style={style}
                  onClick={(event) => selectRow(event, row)}
                  onDoubleClick={() => setMarkupsUi({ rightDockOpen: true })}
                >
                  {visibleIds.map((id) => {
                    const spec = specOf(id);
                    return (
                      <div key={id} role="gridcell" className={cellClass(spec)} style={{ width: columnWidth(id) }}>
                        {renderCell(spec, row, id === firstColumnId)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="markups-list__line markups-list__foot" role="row">
            {visibleIds.map((id) => {
              const spec = specOf(id);
              return (
                <div key={id} role="gridcell" className={cellClass(spec)} style={{ width: columnWidth(id) }}>
                  <span>
                    {id === firstColumnId
                      ? t("markups.list.totalRow", "Total ({{count}})", { count: grandTotals.count })
                      : totalText(grandTotals, spec)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {items.length === 0 && (
          <div className="markups-list__empty">
            {allRows.length === 0
              ? t("markups.list.empty", "No markups on this document.")
              : t("markups.list.noMatches", "No markups match the filters.")}
          </div>
        )}
      </div>
      {notice && (
        <div className="markups-list__notice" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
