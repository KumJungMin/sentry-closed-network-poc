import * as Sentry from "@sentry/react";

export const replayPrivacyOptions = Object.freeze({
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
  block: ["[data-sentry-block]", "[data-private]", ".sentry-block"],
  networkDetailAllowUrls: [],
  networkCaptureBodies: false,
  networkRequestHeaders: [],
  networkResponseHeaders: [],
});

export function createReplayIntegration(): ReturnType<typeof Sentry.replayIntegration> {
  return Sentry.replayIntegration(replayPrivacyOptions);
}
