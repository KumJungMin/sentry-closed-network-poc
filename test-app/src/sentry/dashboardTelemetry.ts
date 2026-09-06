import * as Sentry from "@sentry/react";
import type { NormalizedMetrics } from "../analytics/usageApi";
import type { FunnelSummary } from "../signup-funnel/funnel.core";

type FunnelDashboardSnapshot = Omit<FunnelSummary, "generatedAt" | "steps"> & {
  steps: Array<Omit<FunnelSummary["steps"][number], "id"> & { id: string }>;
};

const commonAttributes = {
  source: "frontend-poc",
  synthetic: true,
} as const;

function recordDashboardSnapshot(name: string, attributes: Record<string, string | number | boolean>): void {
  const span = Sentry.startInactiveSpan({
    name,
    op: "poc.dashboard.snapshot",
    attributes: { ...commonAttributes, ...attributes },
  });
  span.end();
}

export function publishFunnelDashboardSnapshot(summary: FunnelDashboardSnapshot): void {
  Sentry.metrics.gauge("poc.signup.total_attempts", summary.totalAttempts, {
    attributes: commonAttributes,
  });
  Sentry.metrics.gauge("poc.signup.completed_attempts", summary.completedAttempts, {
    attributes: commonAttributes,
  });

  for (const step of summary.steps) {
    const attributes = {
      ...commonAttributes,
      "funnel.name": "signup",
      "funnel.step": step.id,
      "funnel.step_label": step.label,
    };
    Sentry.metrics.gauge("poc.signup.reached", step.reached, { attributes });
    Sentry.metrics.gauge("poc.signup.drop_off", step.dropOff, { attributes });
    Sentry.metrics.gauge("poc.signup.pending_drop_off", step.pendingDropOff, { attributes });
    Sentry.metrics.gauge("poc.signup.drop_off_rate", step.dropOffRate, { attributes });
    Sentry.metrics.gauge("poc.signup.conversion_rate", step.conversionRate, { attributes });
    recordDashboardSnapshot("가입 퍼널 집계", {
      "snapshot.type": "signup_funnel",
      "funnel.step": step.id,
      "funnel.step_label": step.label,
      "funnel.reached": step.reached,
      "funnel.drop_off": step.dropOff,
      "funnel.pending_drop_off": step.pendingDropOff,
      "funnel.drop_off_rate": step.dropOffRate,
      "funnel.conversion_rate": step.conversionRate,
    });
  }
}

export function publishNormalizedDashboardSnapshot(metrics: NormalizedMetrics): void {
  publishFunnelDashboardSnapshot(metrics.funnel);

  for (const item of metrics.errorRanking) {
    const attributes = {
      ...commonAttributes,
      service: item.service,
      issue_key: item.issueKey,
    };
    Sentry.metrics.gauge("poc.usage.error_events", item.errorEvents, { attributes });
    Sentry.metrics.gauge("poc.usage.affected_users", item.affectedUsers, { attributes });
    Sentry.metrics.gauge("poc.usage.active_users", item.activeUsers, { attributes });
    if (item.affectedUserRate !== null) {
      Sentry.metrics.gauge("poc.usage.affected_user_rate", item.affectedUserRate, { attributes });
    }
    recordDashboardSnapshot("사용자 기준 오류 집계", {
      "snapshot.type": "user_normalized_error",
      service: item.service,
      issue_key: item.issueKey,
      "usage.error_events": item.errorEvents,
      "usage.affected_users": item.affectedUsers,
      "usage.active_users": item.activeUsers,
      "usage.affected_user_rate": item.affectedUserRate ?? -1,
    });
  }
}

export type PrivacyDashboardAction =
  | "challenge_requested"
  | "access_opened"
  | "access_denied"
  | "access_revoked";

export function recordPrivacyDashboardState(
  action: PrivacyDashboardAction,
  accessEnabled: boolean,
): void {
  const attributes = {
    ...commonAttributes,
    action,
    access_state: accessEnabled ? "enabled" : "disabled",
  };
  Sentry.logger.info("privacy_access_state_changed", attributes);
  Sentry.metrics.gauge("poc.privacy.access_enabled", accessEnabled ? 1 : 0, {
    attributes,
  });
}

export function recordIdentifiedUserBehavior(
  action: "identity_activated" | "identity_cleared",
  customerId: string,
): void {
  Sentry.logger.info("identified_user_behavior", {
    ...commonAttributes,
    action,
    "user.id": customerId,
  });
  Sentry.metrics.count("poc.user.behavior", 1, {
    attributes: {
      ...commonAttributes,
      action,
    },
  });
}
