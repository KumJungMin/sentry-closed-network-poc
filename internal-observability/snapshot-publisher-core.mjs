import { FLOW_DEFINITIONS } from "./flow-analytics-core.mjs";

export const SNAPSHOT_FLOW_NAMES = Object.freeze(Object.keys(FLOW_DEFINITIONS));
export const DEFAULT_SNAPSHOT_INTERVAL_MS = 60_000;

export function resolveSnapshotInterval(configuredValue) {
  const parsed = Number(configuredValue);
  return Number.isFinite(parsed) && parsed >= 5_000
    ? parsed
    : DEFAULT_SNAPSHOT_INTERVAL_MS;
}

export function normalizeFlowSummary(payload, expectedFlowName) {
  const definition = FLOW_DEFINITIONS[expectedFlowName];
  if (!definition) throw new Error("유효하지 않은 도메인 플로우입니다.");
  if (!payload || typeof payload !== "object" || payload.flowName !== expectedFlowName) {
    throw new Error("플로우 집계 응답의 이름이 올바르지 않습니다.");
  }
  if (!Array.isArray(payload.steps) || payload.steps.length !== definition.steps.length) {
    throw new Error("플로우 집계 응답의 단계가 올바르지 않습니다.");
  }

  return payload;
}

export function buildSnapshotSpanOptions(summary, step, publishedAt = new Date()) {
  return {
    name: "도메인 플로우 정확 집계",
    op: "poc.flow.snapshot",
    attributes: {
      "snapshot.type": "domain_flow_funnel",
      "snapshot.published_at": publishedAt.toISOString(),
      service: summary.service,
      "flow.slug": summary.flowName,
      "flow.version": summary.flowVersion,
      "flow.step": step.id,
      "flow.step_label": step.label,
      "flow.page_path": step.path,
      "flow.total_attempts": summary.totalAttempts,
      "flow.completed_attempts": summary.completedAttempts,
      "flow.reached": step.reached,
      "flow.progressed": step.progressed,
      "flow.drop_off": step.dropOff,
      "flow.pending_drop_off": step.pendingDropOff,
      "flow.drop_off_rate": step.dropOffRate,
      "flow.conversion_rate": step.conversionRate,
      "flow.drop_off_grace_ms": summary.dropOffGracePeriodMs,
    },
  };
}
