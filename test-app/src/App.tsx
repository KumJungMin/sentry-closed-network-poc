import { useState } from "react";
import "./App.css";
import { ExecutionLog } from "./components/ExecutionLog";
import { TestActionCard } from "./components/TestActionCard";
import { CustomDataTestSection } from "./custom-data/CustomDataTestSection";
import { SecurityTestSection } from "./security/SecurityTestSection";
import { testActions } from "./sentry/actions";
import { sentryRuntime } from "./sentry/client";
import type { ExecutionEntry, TestActionDefinition, TestActionId } from "./types";

const maxLogEntries = 8;

function createEntry(
  action: TestActionDefinition,
  result: Awaited<ReturnType<TestActionDefinition["run"]>>,
): ExecutionEntry {
  return {
    ...result,
    id: `${action.id}-${Date.now()}`,
    actionTitle: action.title,
    occurredAt: new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date()),
  };
}

export default function App() {
  const [runningActionId, setRunningActionId] = useState<TestActionId | null>(null);
  const [entries, setEntries] = useState<ExecutionEntry[]>([]);

  const handleRun = async (action: TestActionDefinition) => {
    setRunningActionId(action.id);

    try {
      const result = await action.run();
      setEntries((current) => [createEntry(action, result), ...current].slice(0, maxLogEntries));
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "알 수 없는 실행 오류";
      setEntries((current) => [
        createEntry(action, {
          tone: "failed",
          summary: "테스트 실행 중 예상하지 못한 오류가 발생했습니다.",
          detail,
        }),
        ...current,
      ].slice(0, maxLogEntries));
    } finally {
      setRunningActionId(null);
    }
  };

  return (
    <main>
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Self-hosted observability lab</p>
          <h1>Sentry 이벤트 실험실</h1>
          <p>
            브라우저에서 발생한 신호가 SDK를 거쳐 로컬 Sentry에 도착하는 과정을
            한 단계씩 확인합니다.
          </p>
        </div>

        <aside className="runtime-card" aria-label="Sentry 연결 정보">
          <div className="runtime-card__status">
            <span className={sentryRuntime.enabled ? "status-dot" : "status-dot status-dot--off"} />
            <strong>{sentryRuntime.enabled ? "SDK 연결됨" : "SDK 미연결"}</strong>
          </div>
          <dl>
            <div>
              <dt>Server</dt>
              <dd>127.0.0.1:9000</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>{sentryRuntime.environment}</dd>
            </div>
            <div>
              <dt>Release</dt>
              <dd>{sentryRuntime.release}</dd>
            </div>
          </dl>
        </aside>
      </header>

      {!sentryRuntime.enabled && (
        <section className="setup-notice" role="status">
          <strong>DSN 설정이 필요합니다.</strong>
          <span>`test-app/.env.local`에 `VITE_SENTRY_DSN`을 추가하면 전송이 활성화됩니다.</span>
        </section>
      )}

      <section className="test-section" aria-labelledby="test-section-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Seven focused experiments</p>
            <h2 id="test-section-title">수집 기능 테스트</h2>
          </div>
          <p>한 번에 하나씩 실행한 뒤 Sentry 화면과 비교하세요.</p>
        </div>

        <div className="test-grid">
          {testActions.map((action) => (
            <TestActionCard
              key={action.id}
              action={action}
              isDisabled={runningActionId !== null}
              isRunning={runningActionId === action.id}
              onRun={handleRun}
            />
          ))}
        </div>
      </section>

      <CustomDataTestSection
        environment={sentryRuntime.environment}
        release={sentryRuntime.release}
        isSentryEnabled={sentryRuntime.enabled}
      />

      <SecurityTestSection
        environment={sentryRuntime.environment}
        isSentryEnabled={sentryRuntime.enabled}
      />

      <ExecutionLog entries={entries} />
    </main>
  );
}
