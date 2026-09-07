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
    source = replace_once(
        source,
        """          <TableComponent tableResults={tableResults} {...props} />
""",
        """          {isDomainFlowFunnelWidget(widget) ? (
            <DomainFlowFunnelCard tableResults={tableResults} loading={loading} />
          ) : (
            <TableComponent tableResults={tableResults} {...props} />
          )}
""",
        label="domain flow funnel table replacement",
    )

    old = """function TableComponent({
"""
    new = """function isDomainFlowFunnelWidget(widget: Widget): boolean {
  const query = widget.queries[0];

  return (
    widget.widgetType === WidgetType.SPANS &&
    widget.displayType === DisplayType.TABLE &&
    (query?.conditions ?? '').includes('snapshot.type:domain_flow_funnel') &&
    (query?.fields ?? []).includes('flow.step_display')
  );
}

export type DomainFlowFunnelStep = {
  completedAttempts: number;
  dropOff: number;
  dropOffRate: number;
  flowSlug: string;
  key: string;
  pagePath: string;
  pendingDropOff: number;
  progressed: number;
  reached: number;
  service: string;
  stepDisplay: string;
  stepIndex: number;
  timestamp: string;
  totalAttempts: number;
};

function getFunnelField(row: Record<string, unknown>, fields: string[]): string {
  for (const field of fields) {
    const value = row[field];
    if (defined(value)) {
      return String(value);
    }
  }

  return '';
}

function getFunnelNumber(row: Record<string, unknown>, fields: string[]): number {
  const value = Number(getFunnelField(row, fields));

  return Number.isFinite(value) ? value : 0;
}

export function getDomainFlowFunnelSteps(
  tableResults: TableComponentProps['tableResults']
): DomainFlowFunnelStep[] {
  const rows = (tableResults?.[0]?.data ?? []) as Array<Record<string, unknown>>;
  const latestByStep = new Map<string, DomainFlowFunnelStep>();

  for (const row of rows) {
    const service = getFunnelField(row, ['service']);
    const flowSlug = getFunnelField(row, ['flow.slug']);
    const stepIndex = getFunnelNumber(row, [
      'tags[flow.step_index,number]',
      'flow.step_index',
    ]);
    const stepDisplay = getFunnelField(row, ['flow.step_display', 'flow.step_label']);

    if (!service || !flowSlug || !stepIndex || !stepDisplay) {
      continue;
    }

    const timestamp = getFunnelField(row, ['timestamp']);
    const key = `${service}:${flowSlug}:${stepIndex}`;
    const step = {
      key,
      timestamp,
      service,
      flowSlug,
      stepIndex,
      stepDisplay,
      pagePath: getFunnelField(row, ['flow.page_path']),
      totalAttempts: getFunnelNumber(row, [
        'tags[flow.total_attempts,number]',
        'flow.total_attempts',
      ]),
      completedAttempts: getFunnelNumber(row, [
        'tags[flow.completed_attempts,number]',
        'flow.completed_attempts',
      ]),
      reached: getFunnelNumber(row, ['tags[flow.reached,number]', 'flow.reached']),
      progressed: getFunnelNumber(row, [
        'tags[flow.progressed,number]',
        'flow.progressed',
      ]),
      dropOff: getFunnelNumber(row, ['tags[flow.drop_off,number]', 'flow.drop_off']),
      pendingDropOff: getFunnelNumber(row, [
        'tags[flow.pending_drop_off,number]',
        'flow.pending_drop_off',
      ]),
      dropOffRate: getFunnelNumber(row, [
        'tags[flow.drop_off_rate,number]',
        'flow.drop_off_rate',
      ]),
    };
    const previous = latestByStep.get(key);

    if (!previous || Date.parse(timestamp) >= Date.parse(previous.timestamp)) {
      latestByStep.set(key, step);
    }
  }

  return Array.from(latestByStep.values()).sort((left, right) => {
    const flowCompare =
      left.service.localeCompare(right.service) || left.flowSlug.localeCompare(right.flowSlug);

    return flowCompare || left.stepIndex - right.stepIndex;
  });
}

function DomainFlowFunnelCard({
  loading,
  tableResults,
}: Pick<TableComponentProps, 'loading' | 'tableResults'>): React.ReactNode {
  if (loading || !tableResults?.[0]) {
    return <LoadingPlaceholder />;
  }

  const steps = getDomainFlowFunnelSteps(tableResults);
  const groupedSteps = new Map<string, DomainFlowFunnelStep[]>();

  for (const step of steps) {
    const key = `${step.service}:${step.flowSlug}`;
    groupedSteps.set(key, [...(groupedSteps.get(key) ?? []), step]);
  }

  if (groupedSteps.size === 0) {
    return <WidgetError error={MISSING_DATA_MESSAGE} />;
  }

  return (
    <FunnelBoard>
      {Array.from(groupedSteps.entries()).map(([key, groupSteps]) => {
        const firstStep = groupSteps[0]!;
        const maxDropOffRate = Math.max(...groupSteps.map(step => step.dropOffRate));

        return (
          <FunnelFlowCard key={key}>
            <FunnelFlowHeader>
              <div>
                <strong>{firstStep.flowSlug}</strong>
                <span>{firstStep.service}</span>
              </div>
              <FunnelRate>{maxDropOffRate.toFixed(1)}%</FunnelRate>
            </FunnelFlowHeader>
            <FunnelSteps>
              {groupSteps.map(step => (
                <FunnelStep key={step.key}>
                  <FunnelStepHeader>
                    <strong>{step.stepDisplay}</strong>
                    <code>{step.pagePath}</code>
                  </FunnelStepHeader>
                  <FunnelStepBar>
                    <span style={{width: `${Math.min(step.dropOffRate, 100)}%`}} />
                  </FunnelStepBar>
                  <FunnelStepMetrics>
                    <span>도달 {step.reached}</span>
                    <span>다음 단계 이동 {step.progressed}</span>
                    <span>이탈 확정 {step.dropOff}</span>
                    <strong>{step.dropOffRate.toFixed(1)}%</strong>
                  </FunnelStepMetrics>
                  {step.pendingDropOff > 0 && (
                    <FunnelPending>이탈 판단 대기 {step.pendingDropOff}</FunnelPending>
                  )}
                </FunnelStep>
              ))}
            </FunnelSteps>
          </FunnelFlowCard>
        );
      })}
    </FunnelBoard>
  );
}

function TableComponent({
"""
    source = replace_once(source, old, new, label="domain flow funnel card")

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
    source = replace_once(source, old, new, label="categorical bar drill-down")

    old = """const StyledErrorPanel = styled(ErrorPanel)`
  padding: ${p => p.theme.space.xl};
`;
"""
    new = """const FunnelBoard = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.lg};
`;

const FunnelFlowCard = styled('section')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  min-width: 0;
  padding: ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
`;

const FunnelFlowHeader = styled('header')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};

  div {
    display: grid;
    gap: ${p => p.theme.space.xs};
    min-width: 0;
  }

  strong {
    color: ${p => p.theme.tokens.content.primary};
    font-size: 14px;
  }

  span {
    color: ${p => p.theme.tokens.content.secondary};
    font-size: 12px;
  }
`;

const FunnelRate = styled('strong')`
  color: ${p => p.theme.tokens.content.danger};
  font-size: 20px;
  white-space: nowrap;
`;

const FunnelSteps = styled('ol')`
  display: grid;
  gap: ${p => p.theme.space.sm};
  margin: 0;
  padding: 0;
  list-style: none;
`;

const FunnelStep = styled('li')`
  display: grid;
  gap: ${p => p.theme.space.sm};
  min-width: 0;
  padding: ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.sm};
  background: ${p => p.theme.tokens.background.secondary};
`;

const FunnelStepHeader = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xs};
  min-width: 0;

  strong {
    color: ${p => p.theme.tokens.content.primary};
  }

  code {
    overflow: hidden;
    color: ${p => p.theme.tokens.content.secondary};
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const FunnelStepBar = styled('div')`
  height: 6px;
  overflow: hidden;
  border-radius: ${p => p.theme.radius.sm};
  background: ${p => p.theme.tokens.background.tertiary};

  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: ${p => p.theme.tokens.content.danger};
  }
`;

const FunnelStepMetrics = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: 12px;

  strong {
    margin-left: auto;
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const FunnelPending = styled('span')`
  color: ${p => p.theme.tokens.content.warning};
  font-size: 12px;
`;

const StyledErrorPanel = styled(ErrorPanel)`
  padding: ${p => p.theme.space.xl};
`;
"""
    return replace_once(source, old, new, label="domain flow funnel styles")


def patch_chart_test(source: str) -> str:
    source = replace_once(
        source,
        "import WidgetCardChart from 'sentry/views/dashboards/widgetCard/chart';\n",
        "import WidgetCardChart, {\n"
        "  getCategoricalErrorDrilldownWidget,\n"
        "  getDomainFlowFunnelSteps,\n"
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

  it('keeps only the newest domain flow snapshot per ordered step', () => {
    const steps = getDomainFlowFunnelSteps([
      {
        title: 'domain flow',
        meta: {fields: {}, units: {}},
        data: [
          {
            timestamp: '2026-09-07T00:00:00.000Z',
            service: 'frontend-membership',
            'flow.slug': 'membership',
            'tags[flow.step_index,number]': 2,
            'flow.step_display': '02. 계정 정보',
            'flow.page_path': '/signup/account',
            'tags[flow.reached,number]': 8,
            'tags[flow.progressed,number]': 6,
            'tags[flow.drop_off,number]': 2,
            'tags[flow.pending_drop_off,number]': 0,
            'tags[flow.drop_off_rate,number]': 25,
          },
          {
            timestamp: '2026-09-07T00:01:00.000Z',
            service: 'frontend-membership',
            'flow.slug': 'membership',
            'tags[flow.step_index,number]': 1,
            'flow.step_display': '01. 약관 동의',
            'flow.page_path': '/signup/terms',
            'tags[flow.reached,number]': 10,
            'tags[flow.progressed,number]': 8,
            'tags[flow.drop_off,number]': 1,
            'tags[flow.pending_drop_off,number]': 1,
            'tags[flow.drop_off_rate,number]': 10,
          },
          {
            timestamp: '2026-09-07T00:02:00.000Z',
            service: 'frontend-membership',
            'flow.slug': 'membership',
            'tags[flow.step_index,number]': 2,
            'flow.step_display': '02. 계정 정보',
            'flow.page_path': '/signup/account',
            'tags[flow.reached,number]': 9,
            'tags[flow.progressed,number]': 6,
            'tags[flow.drop_off,number]': 3,
            'tags[flow.pending_drop_off,number]': 0,
            'tags[flow.drop_off_rate,number]': 33.3,
          },
        ],
      },
    ] as Parameters<typeof getDomainFlowFunnelSteps>[0]);

    expect(steps.map(step => step.stepDisplay)).toEqual([
      '01. 약관 동의',
      '02. 계정 정보',
    ]);
    expect(steps[1]!.dropOffRate).toBe(33.3);
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
