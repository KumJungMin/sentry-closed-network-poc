export {
  buildCollectionPolicy,
  ignoredErrors,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeUrl,
} from "./privacy.js";
export type { CollectionPolicy } from "./privacy.js";
export { createReplayIntegration, replayPrivacyOptions } from "./replay.js";
export {
  SentryRoutes,
  initializeObservability,
  resolveObservabilityRuntime,
  setObservedUser,
} from "./client.js";
export type {
  ObservabilityConfig,
  ObservabilityRuntime,
} from "./client.js";
export {
  captureFlowException,
  createSentryFlowEventSink,
  recordFlowEvent,
} from "./flow-telemetry.js";
