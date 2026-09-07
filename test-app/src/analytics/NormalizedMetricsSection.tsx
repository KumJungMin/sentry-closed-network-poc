import { useEffect, useState } from "react";
import { publishNormalizedDashboardSnapshot } from "../sentry/dashboardTelemetry";
import { emitStructuredLog } from "../sentry/logging";
import { fetchNormalizedMetrics, recordUsageEvent, type NormalizedMetrics } from "./usageApi";

interface NormalizedMetricsSectionProps {
  pseudonymousId: string;
}

export function NormalizedMetricsSection({ pseudonymousId }: NormalizedMetricsSectionProps) {
  const [metrics, setMetrics] = useState<NormalizedMetrics | null>(null);
  const [status, setStatus] = useState("내부 활성 사용자 수 연결 확인 중…");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = async () => {
    try {
      const nextMetrics = await fetchNormalizedMetrics();
      setMetrics(nextMetrics);
      publishNormalizedDashboardSnapshot(nextMetrics);
      setStatus("사용자 기준 지표를 최신 상태로 갱신했습니다.");
    } catch {
      setStatus("내부 집계 서버를 실행하세요.");
    }
  };

  useEffect(() => { void refresh(); }, []);

  const recordActivity = async () => {
    setIsSubmitting(true);
    try {
      await recordUsageEvent({ actorId: pseudonymousId, kind: "activity", service: "payment", page: "payment.confirm" });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "활성 사용자 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  const recordError = async () => {
    setIsSubmitting(true);
    try {
      await emitStructuredLog("payment-failed");
      await recordUsageEvent({ actorId: pseudonymousId, kind: "error", service: "payment", issueKey: "synthetic.payment.timeout" });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "영향을 받은 사용자 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="normalized-section" aria-labelledby="normalized-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Affected users ÷ active users</p>
          <h2 id="normalized-title">사용자 기준 오류 순위·이탈률</h2>
        </div>
        <p>{status}</p>
      </div>
      <div className="normalized-actions">
        <button type="button" disabled={!pseudonymousId || isSubmitting} onClick={() => void recordActivity()}>활성 사용자 +1</button>
        <button type="button" disabled={!pseudonymousId || isSubmitting} onClick={() => void recordError()}>Sentry 오류와 영향을 받은 사용자 기록</button>
        {!pseudonymousId && <span>먼저 가명 ID를 연결하세요.</span>}
      </div>
      <div className="normalized-grid">
        <article>
          <h3>영향을 받은 사용자 순위</h3>
          {(metrics?.errorRanking.length ?? 0) === 0 ? <p>집계된 오류가 없습니다.</p> : (
            <ol>{metrics?.errorRanking.map((item) => (
              <li key={`${item.service}:${item.issueKey}`}>
                <div><strong>{item.issueKey}</strong><span>{item.service}</span></div>
                <div><span>{item.affectedUsers}/{item.activeUsers}명</span><strong>{item.affectedUserRate === null ? "기준 사용자 수 없음" : `${item.affectedUserRate}%`}</strong></div>
              </li>
            ))}</ol>
          )}
        </article>
        <article>
          <h3>가입 화면별 이탈률</h3>
          <p>다음 pageView가 없으면 유예시간 후 이탈 확정으로 계산합니다.</p>
          <ol>{metrics?.funnel.steps.map((step) => (
            <li key={step.id}>
              <div><strong>{step.label}</strong><span>도달 {step.reached}명</span></div>
              <div><span>이탈 확정 {step.dropOff}명</span><strong>{step.dropOffRate}%</strong></div>
              <div><span>이탈 판단 대기</span><strong>{step.pendingDropOff}명</strong></div>
            </li>
          ))}</ol>
        </article>
      </div>
    </section>
  );
}
