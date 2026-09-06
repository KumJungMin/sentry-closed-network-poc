#!/usr/bin/env python3
"""Apply the Sentry 26.8 categorical error drill-down source patch.

The patch is intentionally guarded by exact source fragments. A Sentry upgrade
must be reviewed instead of silently producing a partially patched image.
"""

from __future__ import annotations

import argparse
from pathlib import Path


CHART_PATH = Path("static/app/views/dashboards/widgetCard/chart.tsx")
CHART_TEST_PATH = Path("static/app/views/dashboards/widgetCard/chart.spec.tsx")
TABLE_VIEW_PATH = Path("static/app/views/discover/table/tableView.tsx")
TABLE_VIEW_TEST_PATH = Path("static/app/views/discover/table/tableView.spec.tsx")


def replace_once(source: str, old: str, new: str, *, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one source match, found {count}")
    return source.replace(old, new, 1)


def patch_chart(source: str) -> str:
    source = replace_once(
        source,
        "import {decodeSorts} from 'sentry/utils/queryString';\n",
        "import {decodeSorts} from 'sentry/utils/queryString';\n"
        "import {MutableSearch} from 'sentry/utils/tokenizeSearch';\n",
        label="MutableSearch import",
    )
    source = replace_once(
        source,
        "import {eventViewFromWidget} from 'sentry/views/dashboards/utils';\n",
        "import {\n"
        "  eventViewFromWidget,\n"
        "  getWidgetDiscoverUrl,\n"
        "} from 'sentry/views/dashboards/utils';\n",
        label="dashboard URL import",
    )

    old = """function CategoricalSeriesComponent(props: TableComponentProps): React.ReactNode {
  const {widget, tableResults, loading} = props;
"""
    new = """export function getCategoricalErrorDrilldownWidget(
  widget: Widget,
  field: string,
  value: string
): Widget {
  const query = widget.queries[0];
  const search = new MutableSearch(query?.conditions ?? '');
  search.addFilterValue(field, value);

  const detailFields = ['id', 'timestamp', 'title', 'project', 'user', field].filter(
    (detailField, index, fields) => fields.indexOf(detailField) === index
  );

  return {
    ...widget,
    title: `${widget.title}: ${value}`,
    displayType: DisplayType.TABLE,
    limit: 100,
    queries: [
      {
        ...query!,
        conditions: search.formatString(),
        fields: detailFields,
        aggregates: [],
        columns: detailFields,
        fieldAliases: [],
        orderby: '-timestamp',
        selectedAggregate: undefined,
      },
    ],
  };
}

function CategoricalSeriesComponent(props: TableComponentProps): React.ReactNode {
  const {widget, tableResults, loading, selection, dashboardFilters} = props;
  const organization = useOrganization();
  const navigate = useNavigate();
"""
    source = replace_once(source, old, new, label="categorical component header")

    old = """  const categoricalSeriesData = transformTableToCategoricalSeries(filteredQuery, {
    data: tableData.data,
    meta: {
      fields: (tableData.meta.fields ?? {}) as TabularData['meta']['fields'],
      units: (tableData.meta.units ?? {}) as TabularData['meta']['units'],
    },
  });

  const plottables = categoricalSeriesData.map(series => new Bars(series));
"""
    new = """  const categoricalSeriesData = transformTableToCategoricalSeries(filteredQuery, {
    data: tableData.data,
    meta: {
      fields: (tableData.meta.fields ?? {}) as TabularData['meta']['fields'],
      units: (tableData.meta.units ?? {}) as TabularData['meta']['units'],
    },
  });

  const groupBy = filteredQuery.columns[0];
  const canDrillDown = widget.widgetType === WidgetType.ERRORS && defined(groupBy);
  const plottables = categoricalSeriesData.map(
    series =>
      new Bars(series, {
        onClick: canDrillDown
          ? item => {
              if (!defined(item.category)) {
                return;
              }

              const drilldownWidget = getCategoricalErrorDrilldownWidget(
                widget,
                groupBy,
                String(item.category)
              );
              navigate(
                getWidgetDiscoverUrl(
                  drilldownWidget,
                  dashboardFilters,
                  selection,
                  organization
                )
              );
            }
          : undefined,
      })
  );
"""
    return replace_once(source, old, new, label="categorical bar drill-down")


def patch_chart_test(source: str) -> str:
    source = replace_once(
        source,
        "import WidgetCardChart from 'sentry/views/dashboards/widgetCard/chart';\n",
        "import WidgetCardChart, {\n"
        "  getCategoricalErrorDrilldownWidget,\n"
        "} from 'sentry/views/dashboards/widgetCard/chart';\n",
        label="chart test import",
    )
    marker = """  it('renders \"No Data\" when no row has a plottable value', () => {
"""
    test = """  it('builds an event-level Discover query for a selected error bar', () => {
    const widget = WidgetFixture({
      title: 'Errors by Service',
      displayType: DisplayType.CATEGORICAL_BAR,
      queries: [
        WidgetQueryFixture({
          conditions: 'has:service',
          columns: ['service'],
          aggregates: ['count()'],
          fields: ['service', 'count()'],
        }),
      ],
    });

    const drilldownWidget = getCategoricalErrorDrilldownWidget(
      widget,
      'service',
      'payment api'
    );

    expect(drilldownWidget.title).toBe('Errors by Service: payment api');
    expect(drilldownWidget.displayType).toBe(DisplayType.TABLE);
    expect(drilldownWidget.queries[0]).toMatchObject({
      conditions: 'has:service service:\"payment api\"',
      fields: ['id', 'timestamp', 'title', 'project', 'user', 'service'],
      aggregates: [],
      columns: ['id', 'timestamp', 'title', 'project', 'user', 'service'],
      orderby: '-timestamp',
    });
  });

"""
    return replace_once(source, marker, test + marker, label="chart drill-down test")


def patch_table_view(source: str) -> str:
    old = """    } else if (columnKey === 'transaction' && dataRow.transaction) {
"""
    new = """    } else if (columnKey === 'title' && dataRow.id && !isTransactionsDataset) {
      cell = (
        <StyledLink
          to={getEventTarget({
            dataRow,
            eventView,
            isTransactionsDataset,
            location,
            organization,
          })}
        >
          {cell}
        </StyledLink>
      );
    } else if (columnKey === 'transaction' && dataRow.transaction) {
"""
    return replace_once(source, old, new, label="event title detail link")


def patch_table_view_test(source: str) -> str:
    source = replace_once(
        source,
        "await userEvent.click(buttons[buttons.length - 1]!);",
        "await userEvent.click(buttons[buttons.length - 1]);",
        label="table view test lint compatibility",
    )
    marker = """  it('handles go to release', async () => {
"""
    test = """  it('opens issue event details from an error title link', async () => {
    const view = EventView.fromLocation(
      LocationFixture({
        query: {...locationQuery, field: ['id', 'title']},
      })
    );
    rows.meta = {...rows.meta, id: 'string', 'issue.id': 'integer'};
    rows.data[0] = {
      ...rows.data[0]!,
      id: 'deadbeef',
      'issue.id': 123,
      'project.name': 'project-slug',
    };

    const {router} = renderComponent(rows, view, SavedQueryDatasets.ERRORS);
    const firstRow = screen.getAllByRole('row')[1]!;

    await userEvent.click(within(firstRow).getByRole('link', {name: 'some title'}));

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/issues/123/events/deadbeef/'
    );
    expect(router.location.query.referrer).toBe('discover-events-table');
  });

"""
    return replace_once(source, marker, test + marker, label="event title link test")


def patch_file(path: Path, transform) -> None:
    original = path.read_text()
    patched = transform(original)
    path.write_text(patched)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_root", type=Path)
    args = parser.parse_args()

    patch_file(args.source_root / CHART_PATH, patch_chart)
    patch_file(args.source_root / CHART_TEST_PATH, patch_chart_test)
    patch_file(args.source_root / TABLE_VIEW_PATH, patch_table_view)
    patch_file(args.source_root / TABLE_VIEW_TEST_PATH, patch_table_view_test)


if __name__ == "__main__":
    main()
