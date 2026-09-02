import type { TestActionDefinition } from "../types";

interface TestActionCardProps {
  action: TestActionDefinition;
  isDisabled: boolean;
  isRunning: boolean;
  onRun: (action: TestActionDefinition) => void;
}

export function TestActionCard({
  action,
  isDisabled,
  isRunning,
  onRun,
}: TestActionCardProps) {
  return (
    <article className="test-card">
      <div className="test-card__heading">
        <span className="test-card__number" aria-hidden="true">
          {action.index}
        </span>
        <div>
          <p className="test-card__feature">{action.sentryFeature}</p>
          <h2>{action.title}</h2>
        </div>
      </div>
      <p className="test-card__description">{action.description}</p>
      <div className="test-card__expected">
        <span>확인할 내용</span>
        <p>{action.expectedResult}</p>
      </div>
      <button type="button" disabled={isDisabled} onClick={() => onRun(action)}>
        {isRunning ? "실행 중…" : isDisabled ? "다른 테스트 실행 중" : "테스트 실행"}
      </button>
    </article>
  );
}
