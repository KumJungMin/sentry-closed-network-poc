import * as Sentry from "@sentry/react";
import {
  buildCollectionPolicy,
  ignoredErrors,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from "../security/securityPolicy.core";

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim() ?? "";
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || "local";
const collectionPolicy = buildCollectionPolicy(
  environment,
  import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
);
const explicitlyDisabled = import.meta.env.VITE_SENTRY_ENABLED?.trim().toLowerCase() === "false";

export const sentryRuntime = {
  enabled: dsn.length > 0 && !explicitlyDisabled,
  environment,
  release: import.meta.env.VITE_APP_RELEASE?.trim() || "frontend-poc@0.1.0",
  tracesSampleRate: collectionPolicy.tracesSampleRate,
  replayEnabled: false,
  defaultPiiEnabled: false,
} as const;

if (sentryRuntime.enabled) {
  Sentry.init({
    dsn,
    environment: sentryRuntime.environment,
    release: sentryRuntime.release,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: collectionPolicy.tracesSampleRate,
    replaysSessionSampleRate: collectionPolicy.replaySessionSampleRate,
    replaysOnErrorSampleRate: collectionPolicy.replayOnErrorSampleRate,
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
    beforeBreadcrumb: sanitizeSentryBreadcrumb,
    ignoreErrors: ignoredErrors,
    tracePropagationTargets: ["localhost", "127.0.0.1", /^\//],
  });
}
