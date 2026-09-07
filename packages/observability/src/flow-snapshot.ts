import type { FlowName, FlowStepId } from "@poc/flow-contract";
import * as Sentry from "@sentry/react";

export interface FlowFunnelSummaryStep {
  id: FlowStepId;
  label: string;
  path: string;
  reached: number;
  progressed: number;
  dropOff: number;
  pendingDropOff: number;
  dropOffRate: number;
  conversionRate: number;
}

export interface FlowFunnelSummary {
  flowName: FlowName;
  flowVersion: number;
  service: string;
  dropOffGracePeriodMs: number;
  totalAttempts: number;
  completedAttempts: number;
  steps: FlowFunnelSummaryStep[];
}

export function publishFlowFunnelSnapshot(summary: FlowFunnelSummary): void {
  for (const step of summary.steps) {
    const span = Sentry.startInactiveSpan({
      name: "도메인 플로우 정확 집계",
      op: "poc.flow.snapshot",
      attributes: {
        "snapshot.type": "domain_flow_funnel",
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
    });
    span.end();
  }
}
