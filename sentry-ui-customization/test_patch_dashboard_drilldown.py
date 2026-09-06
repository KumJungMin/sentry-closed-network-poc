from __future__ import annotations

import unittest

from patch_dashboard_drilldown import (
    patch_chart,
    patch_chart_test,
    patch_table_view,
    patch_table_view_test,
    replace_once,
)


class DashboardDrilldownPatchTest(unittest.TestCase):
    def test_replacement_requires_exactly_one_match(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "expected one source match"):
            replace_once("", "missing", "new", label="guard")

        with self.assertRaisesRegex(RuntimeError, "found 2"):
            replace_once("old old", "old", "new", label="guard")

    def test_chart_patch_adds_event_drilldown(self) -> None:
        source = """import {decodeSorts} from 'sentry/utils/queryString';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
function CategoricalSeriesComponent(props: TableComponentProps): React.ReactNode {
  const {widget, tableResults, loading} = props;
  const categoricalSeriesData = transformTableToCategoricalSeries(filteredQuery, {
    data: tableData.data,
    meta: {
      fields: (tableData.meta.fields ?? {}) as TabularData['meta']['fields'],
      units: (tableData.meta.units ?? {}) as TabularData['meta']['units'],
    },
  });

  const plottables = categoricalSeriesData.map(series => new Bars(series));
"""

        patched = patch_chart(source)

        self.assertIn("getCategoricalErrorDrilldownWidget", patched)
        self.assertIn("widget.widgetType === WidgetType.ERRORS", patched)
        self.assertIn("getWidgetDiscoverUrl(", patched)
        self.assertIn("orderby: '-timestamp'", patched)

    def test_chart_test_patch_adds_query_contract(self) -> None:
        source = """import WidgetCardChart from 'sentry/views/dashboards/widgetCard/chart';
  it('renders \"No Data\" when no row has a plottable value', () => {
"""

        patched = patch_chart_test(source)

        self.assertIn("builds an event-level Discover query", patched)
        self.assertIn('service:"payment api"', patched)

    def test_table_view_patch_links_error_titles(self) -> None:
        source = """    } else if (columnKey === 'transaction' && dataRow.transaction) {
"""

        patched = patch_table_view(source)

        self.assertIn("columnKey === 'title'", patched)
        self.assertIn("!isTransactionsDataset", patched)
        self.assertIn("to={getEventTarget({", patched)

    def test_table_view_test_patch_adds_title_navigation_contract(self) -> None:
        source = """await userEvent.click(buttons[buttons.length - 1]!);
  it('handles go to release', async () => {
"""

        patched = patch_table_view_test(source)

        self.assertIn("opens issue event details from an error title link", patched)
        self.assertIn("getByRole('link', {name: 'some title'})", patched)
        self.assertIn("issues/123/events/deadbeef", patched)
        self.assertIn("userEvent.click(buttons[buttons.length - 1]);", patched)


if __name__ == "__main__":
    unittest.main()
