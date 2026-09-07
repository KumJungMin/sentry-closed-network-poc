import {
  captureFlowException,
  createObservedFlowEventSink,
  initializeObservability,
  SentryRoutes,
} from "@poc/observability";

export const observabilityRuntime = initializeObservability({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: import.meta.env.VITE_SENTRY_ENABLED?.toLowerCase() !== "false",
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  release: import.meta.env.VITE_APP_RELEASE ?? "payment-web@0.1.0-local",
  service: "frontend-payment",
  tracesSampleRate: import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
  replayEnabled: import.meta.env.VITE_SENTRY_REPLAY_ENABLED,
  replayOnErrorSampleRate: import.meta.env.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
  logsEnabled: import.meta.env.VITE_SENTRY_LOGS_ENABLED?.toLowerCase() !== "false",
});

export const flowEventSink = createObservedFlowEventSink();
export { captureFlowException, SentryRoutes };
