import type { ExecutionEntry } from "../types";

interface ExecutionLogProps {
  entries: ExecutionEntry[];
}

const toneLabel = {
  sent: "전송 요청",
  scheduled: "발생 예약",
  "expected-error": "예상된 실패",
  failed: "실행 실패",
} as const;

export function ExecutionLog({ entries }: ExecutionLogProps) {
  return (
    <section className="execution-log" aria-labelledby="execution-log-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local activity</p>
          <h2 id="execution-log-title">최근 실행 결과</h2>
        </div>
        <span>{entries.length}건</span>
      </div>

      <div className="execution-log__body" aria-live="polite">
        {entries.length === 0 ? (
          <p className="execution-log__empty">
            아직 실행한 테스트가 없습니다. 위 버튼을 하나씩 눌러보세요.
          </p>
        ) : (
          <ol>
            {entries.map((entry) => (
              <li key={entry.id}>
                <div className="execution-log__meta">
                  <span className={`result-chip result-chip--${entry.tone}`}>
                    {toneLabel[entry.tone]}
                  </span>
                  <time>{entry.occurredAt}</time>
                </div>
                <strong>{entry.actionTitle}</strong>
                <p>{entry.summary}</p>
                <small>{entry.detail}</small>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
