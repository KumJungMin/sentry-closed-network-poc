import { useState } from "react";
import { emitStructuredLog, logScenarios, type LogScenarioId } from "../sentry/logging";

interface LiveLogsSectionProps {
  isSentryEnabled: boolean;
  logsEnabled: boolean;
}

export function LiveLogsSection({ isSentryEnabled, logsEnabled }: LiveLogsSectionProps) {
  const [runningId, setRunningId] = useState<LogScenarioId | null>(null);
  const [result, setResult] = useState("아직 전송한 로그가 없습니다.");
  const enabled = isSentryEnabled && logsEnabled;

  const emit = async (id: LogScenarioId) => {
    setRunningId(id);
    try {
      const message = await emitStructuredLog(id);
      setResult(`${message} 전송 완료 · Explore > Logs에서 검색하세요.`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "로그 전송 실패");
    } finally {
      setRunningId(null);
    }
  };

  return (
    <section className="live-logs-section" aria-labelledby="live-logs-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Near-real-time structured logs</p>
          <h2 id="live-logs-title">실시간 오류·커스텀 로그</h2>
        </div>
        <p>Sentry 처리 큐를 거치므로 수 초의 지연이 생길 수 있습니다.</p>
      </div>
      <div className="live-log-grid">
        {logScenarios.map((scenario) => (
          <article key={scenario.id} className="live-log-card">
            <span className={`log-level log-level--${scenario.level}`}>{scenario.level}</span>
            <h3>{scenario.title}</h3>
            <code>{scenario.message}</code>
            <p>{scenario.description}</p>
            <button
              type="button"
              disabled={!enabled || runningId !== null}
              onClick={() => void emit(scenario.id)}
            >
              {!enabled ? "Logs 연결 필요" : runningId === scenario.id ? "전송 중…" : "로그 전송"}
            </button>
          </article>
        ))}
      </div>
      <p className="live-log-result" role="status">{result}</p>
    </section>
  );
}
