import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim() ?? "";

export const sentryRuntime = {
  enabled: dsn.length > 0,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || "local",
  release: import.meta.env.VITE_APP_RELEASE?.trim() || "frontend-poc@0.1.0",
} as const;

if (sentryRuntime.enabled) {
  Sentry.init({
    dsn,
    environment: sentryRuntime.environment,
    release: sentryRuntime.release,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    tracePropagationTargets: ["localhost", "127.0.0.1", /^\//],
  });
}
