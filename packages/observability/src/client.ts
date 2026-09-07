import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import {
  buildCollectionPolicy,
  ignoredErrors,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  type CollectionPolicy,
} from "./privacy.js";
import { createReplayIntegration } from "./replay.js";

export interface ObservabilityConfig {
  dsn?: string;
  enabled?: boolean;
  environment?: string;
  release: string;
  service: "frontend-membership" | "frontend-remittance" | "frontend-payment";
  tracesSampleRate?: string;
  replayEnabled?: string;
  replayOnErrorSampleRate?: string;
  logsEnabled?: boolean;
}

export interface ObservabilityRuntime extends CollectionPolicy {
  enabled: boolean;
  environment: string;
  release: string;
  service: ObservabilityConfig["service"];
  logsEnabled: boolean;
}

export function resolveObservabilityRuntime(config: ObservabilityConfig): ObservabilityRuntime {
  const environment = config.environment?.trim() || "local";
  const collectionPolicy = buildCollectionPolicy(
    environment,
    config.tracesSampleRate,
    config.replayEnabled,
    config.replayOnErrorSampleRate,
  );
  return {
    enabled: Boolean(config.dsn?.trim()) && config.enabled !== false,
    environment,
    release: config.release,
    service: config.service,
    logsEnabled: config.logsEnabled !== false,
    ...collectionPolicy,
  };
}

export function initializeObservability(config: ObservabilityConfig): ObservabilityRuntime {
  const runtime = resolveObservabilityRuntime(config);
  if (!runtime.enabled) return runtime;

  Sentry.init({
    dsn: config.dsn?.trim(),
    environment: runtime.environment,
    release: runtime.release,
    enableLogs: runtime.logsEnabled,
    integrations: [
      Sentry.reactRouterBrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      ...(runtime.replayEnabled ? [createReplayIntegration()] : []),
    ],
    tracesSampleRate: runtime.tracesSampleRate,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: runtime.replayOnErrorSampleRate,
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
    beforeBreadcrumb: sanitizeSentryBreadcrumb,
    ignoreErrors: ignoredErrors,
    tracePropagationTargets: ["localhost", "127.0.0.1", /^\//u],
  });
  Sentry.setTag("service", runtime.service);
  return runtime;
}

export function setObservedUser(userId: string | undefined): void {
  if (userId === undefined) {
    Sentry.setUser(null);
    return;
  }
  if (userId.length === 0 || userId.length > 128) {
    throw new Error("user.id는 1자 이상 128자 이하여야 합니다.");
  }
  Sentry.setUser({ id: userId });
}

export const SentryRoutes = Sentry.wrapReactRouterRouting(Routes);
