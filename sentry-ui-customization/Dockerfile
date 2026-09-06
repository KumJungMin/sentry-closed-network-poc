ARG SENTRY_SOURCE_IMAGE=sentry-self-hosted-local
ARG SENTRY_RUNTIME_IMAGE=sentry-self-hosted-local

FROM ${SENTRY_SOURCE_IMAGE} AS sentry-source

FROM node:24.14.0-bookworm-slim AS frontend-builder

RUN apt-get update \
    && apt-get install --yes --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable
WORKDIR /usr/src/sentry
COPY --from=sentry-source /usr/src/sentry /usr/src/sentry
COPY patch_dashboard_drilldown.py /tmp/patch_dashboard_drilldown.py
COPY test_patch_dashboard_drilldown.py /tmp/test_patch_dashboard_drilldown.py

RUN pnpm install --frozen-lockfile
RUN cd /tmp \
    && python3 -m unittest test_patch_dashboard_drilldown.py \
    && python3 /tmp/patch_dashboard_drilldown.py /usr/src/sentry
RUN pnpm run lint:js static/app/views/dashboards/widgetCard/chart.tsx \
    static/app/views/dashboards/widgetCard/chart.spec.tsx \
    static/app/views/discover/table/tableView.tsx \
    static/app/views/discover/table/tableView.spec.tsx
RUN pnpm run build-production

FROM ${SENTRY_RUNTIME_IMAGE}

COPY --from=frontend-builder /usr/src/sentry/src/sentry/static/sentry/dist/ /usr/src/sentry/src/sentry/static/sentry/dist/
