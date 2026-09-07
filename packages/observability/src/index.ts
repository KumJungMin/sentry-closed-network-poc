export {
  buildCollectionPolicy,
  ignoredErrors,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeUrl,
} from "./privacy.js";
export type { CollectionPolicy } from "./privacy.js";
export { createReplayIntegration, replayPrivacyOptions } from "./replay.js";
