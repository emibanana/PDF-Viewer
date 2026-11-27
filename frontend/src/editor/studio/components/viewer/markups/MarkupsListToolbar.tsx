import { useTranslation } from "react-i18next";
import { ActionIcon } from "@editor/ui/ActionIcon";
import { Button } from "@editor/ui/Button";
import { Checkbox } from "@editor/ui/Checkbox";
import { Dropdown } from "@editor/ui/Dropdown";
import { Icon, type IconName } from "@editor/ui/Icon";
import { Input } from "@editor/ui/Input";
import {
  MARKUP_COLUMNS,
  defaultMarkupListLayout,
  type MarkupColumnId,
  type MarkupListLayout,
} from "@editor/services/markups/markupColumns";
import type { RowFacet, RowFacetFilter } from "@editor/services/markups/markupRows";

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export type FacetOptions = Record<RowFacet, FacetOption[]>;

const FACET_ORDER: readonly RowFacet[] = ["type", "page", "author", "status"];

interface MarkupsListToolbarProps {
  shownCount: number;
  totalCount: number;
  query: string;
  onQueryChange: (query: string) => void;
  facetOptions: FacetOptions;
  facets: RowFacetFilter;
  onFacetsChange: (facets: RowFacetFilter) => void;
  grouped: boolean;
  onToggleGrouped: () => void;
  allCollapsed: boolean;
  onToggleCollapsed: () => void;
  layout: MarkupListLayout;
  onLayoutChange: (layout: MarkupListLayout) => void;
  selectedCount: number;
  selectionHidden: boolean;
  onToggleHidden: () => void;
  onDelete: () => void;
  onExport: () => void;
  onClose: () => void;
}

function ToolButton({
  icon,
  label,
  onClick,
  pressed,
  disabled,
  accent,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  accent?: "danger";
}) {
  return (
    <ActionIcon
      variant="tertiary"
      size="sm"
      accent={accent}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={pressed ? "markups-list__tool--on" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size="1rem" />
    </ActionIcon>
  );
}

function moveColumn(order: MarkupColumnId[], id: MarkupColumnId, step: -1 | 1): MarkupColumnId[] {
  const from = order.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function ColumnChooser({ layout, onLayoutChange }: Pick<MarkupsListToolbarProps, "layout" | "onLayoutChange">) {
  const { t } = useTranslation();
  const hidden = new Set(layout.hidden);
  const toggle = (id: MarkupColumnId) => {
    const next = hidden.has(id) ? layout.hidden.filter((entry) => entry !== id) : [...layout.hidden, id];
    onLayoutChange({ ...layout, hidden: next });
  };
  return (
    <Dropdown.Root align="end">
      <Dropdown.Trigger popupRole="dialog">
        <ActionIcon
          variant="tertiary"
          size="sm"
          aria-label={t("markups.list.columnsMenu", "Columns")}
          title={t("markups.list.columnsMenu", "Columns")}
        >
          <Icon name="columns-3" size="1rem" />
        </ActionIcon>
      </Dropdown.Trigger>
      <Dropdown.Menu role="dialog" ariaLabel={t("markups.list.columnsMenu", "Columns")} width={240}>
        <div className="markups-list__popover">
          {layout.order.map((id, index) => {
            const spec = MARKUP_COLUMNS.find((column) => column.id === id);
            if (!spec) return null;
            const label = t(spec.labelKey, spec.defaultLabel);
            return (
              <div key={id} className="markups-list__column-row">
                <Checkbox label={label} checked={!hidden.has(id)} onChange={() => toggle(id)} />
                <ActionIcon
                  variant="quiet"
                  size="sm"
                  aria-label={t("markups.list.moveUp", "Move {{column}} up", { column: label })}
                  disabled={index === 0}
                  onClick={() => onLayoutChange({ ...layout, order: moveColumn(layout.order, id, -1) })}
                >
                  <Icon name="chevron-up" size="0.9rem" />
                </ActionIcon>
                <ActionIcon
                  variant="quiet"
                  size="sm"
                  aria-label={t("markups.list.moveDown", "Move {{column}} down", { column: label })}
                  disabled={index === layout.order.length - 1}
                  onClick={() => onLayoutChange({ ...layout, order: moveColumn(layout.order, id, 1) })}
                >
                  <Icon name="chevron-down" size="0.9rem" />
                </ActionIcon>
              </div>
            );
          })}
          <div className="markups-list__popover-footer">
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => {
                const defaults = defaultMarkupListLayout();
                onLayoutChange({ ...layout, order: defaults.order, hidden: defaults.hidden, widths: {} });
              }}
            >
              {t("markups.list.resetColumns", "Reset columns")}
            </Button>
          </div>
        </div>
      </Dropdown.Menu>
    </Dropdown.Root>
  );
}

function FilterList({
  facetOptions,
  facets,
  onFacetsChange,
}: Pick<MarkupsListToolbarProps, "facetOptions" | "facets" | "onFacetsChange">) {
  const { t } = useTranslation();
  const headings: Record<RowFacet, string> = {
    type: t("markups.list.filter.type", "Type"),
    page: t("markups.list.filter.page", "Page"),
    author: t("markups.list.filter.author", "Author"),
    status: t("markups.list.filter.status", "Status"),
  };
  const activeCount = FACET_ORDER.reduce((sum, facet) => sum + (facets[facet]?.size ?? 0), 0);
  const toggle = (facet: RowFacet, value: string) => {
    const next = new Set(facets[facet] ?? []);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onFacetsChange({ ...facets, [facet]: next });
  };
  return (
    <Dropdown.Root align="start">
      <Dropdown.Trigger popupRole="dialog">
        <Button variant="tertiary" size="sm" leftSection={<Icon name="sliders-horizontal" size="0.9rem" />}>
          {t("markups.list.filterList", "Filter List")}
          {activeCount > 0 && <span className="markups-list__badge">{activeCount}</span>}
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Menu role="dialog" ariaLabel={t("markups.list.filterList", "Filter List")} width={260}>
        <div className="markups-list__popover">
          {FACET_ORDER.map((facet) =>
            facetOptions[facet].length === 0 ? null : (
              <div key={facet} className="markups-list__popover-section">
                <div className="markups-list__popover-heading">{headings[facet]}</div>
                {facetOptions[facet].map((option) => (
                  <Checkbox
                    key={option.value}
                    label={`${option.label} (${option.count})`}
                    checked={facets[facet]?.has(option.value) ?? false}
                    onChange={() => toggle(facet, option.value)}
                  />
                ))}
              </div>
            ),
          )}
          <div className="markups-list__popover-footer">
            <Button variant="tertiary" size="sm" disabled={activeCount === 0} onClick={() => onFacetsChange({})}>
              {t("markups.list.clearFilters", "Clear filters")}
            </Button>
          </div>
        </div>
      </Dropdown.Menu>
    </Dropdown.Root>
  );
}

/** The header bar of the Markups List: title, search, Filter List, view toggles, selection actions, export and close. */
export function MarkupsListToolbar(props: MarkupsListToolbarProps) {
  const { t } = useTranslation();
  const hasSelection = props.selectedCount > 0;
  return (
    <div className="markups-list__bar">
      <span className="markups-list__title">
        {t("markups.bar.list", "Markups List")}
        <span className="markups-list__count">
          {props.shownCount === props.totalCount
            ? props.totalCount
            : t("markups.list.countOf", "{{shown}} of {{total}}", { shown: props.shownCount, total: props.totalCount })}
        </span>
      </span>
      <Input
        inputSize="sm"
        className="markups-list__search"
        type="search"
        value={props.query}
        placeholder={t("markups.list.search", "Search markups")}
        aria-label={t("markups.list.search", "Search markups")}
        leadingIcon={<Icon name="search" size="0.9rem" />}
        onChange={(event) => props.onQueryChange(event.target.value)}
      />
      <FilterList facetOptions={props.facetOptions} facets={props.facets} onFacetsChange={props.onFacetsChange} />
      <ToolButton
        icon="layers"
        label={t("markups.list.groupBySubject", "Group by subject")}
        pressed={props.grouped}
        onClick={props.onToggleGrouped}
      />
      <ToolButton
        icon={props.allCollapsed ? "chevrons-up-down" : "chevrons-down-up"}
        label={props.allCollapsed ? t("markups.list.expandAll", "Expand all") : t("markups.list.collapseAll", "Collapse all")}
        disabled={!props.grouped}
        onClick={props.onToggleCollapsed}
      />
      <ColumnChooser layout={props.layout} onLayoutChange={props.onLayoutChange} />
      <span className="markups-list__spacer" />
      <ToolButton
        icon={props.selectionHidden ? "eye" : "eye-off"}
        label={
          props.selectionHidden
            ? t("markups.list.showSelected", "Show selected")
            : t("markups.list.hideSelected", "Hide selected")
        }
        disabled={!hasSelection}
        onClick={props.onToggleHidden}
      />
      <ToolButton
        icon="trash"
        accent="danger"
        label={t("markups.list.deleteSelected", "Delete selected")}
        disabled={!hasSelection}
        onClick={props.onDelete}
      />
      <ToolButton
        icon="download"
        label={t("markups.list.exportCsv", "Export to CSV")}
        disabled={props.shownCount === 0}
        onClick={props.onExport}
      />
      <ToolButton icon="x" label={t("common.close", "Close")} onClick={props.onClose} />
    </div>
  );
}
