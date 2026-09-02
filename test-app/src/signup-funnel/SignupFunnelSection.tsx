import { useEffect, useState } from "react";
import {
  createAttemptId,
  signupSteps,
  type FunnelSummary,
} from "./funnel.core";
import { fetchFunnelSummary, recordFunnelEvent } from "./funnelApi";

export function SignupFunnelSection() {
  const [attemptId, setAttemptId] = useState(() => createAttemptId());
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [summary, setSummary] = useState<FunnelSummary | null>(null);
  const [status, setStatus] = useState("집계 서버 연결 확인 중…");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshSummary = async () => {
    try {
      setSummary(await fetchFunnelSummary());
      setStatus("망 내부 집계 서버 연결됨");
    } catch {
      setStatus("집계 서버 미연결 · pnpm analytics를 실행하세요");
    }
  };

  useEffect(() => {
    void refreshSummary();
  }, []);

  const run = async (task: () => Promise<void>) => {
    setIsSubmitting(true);
    try {
      await task();
      await refreshSummary();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "퍼널 이벤트 처리 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  const start = () => void run(async () => {
    await recordFunnelEvent(attemptId, "terms", "entered");
    setStepIndex(0);
  });

  const advance = () => void run(async () => {
    if (stepIndex === null) return;
    const currentStep = signupSteps[stepIndex];
    const nextStep = signupSteps[stepIndex + 1];

    if (!nextStep) {
      await recordFunnelEvent(attemptId, currentStep.id, "completed");
      setStepIndex(null);
      setAttemptId(createAttemptId());
      setStatus("가입 완료 이벤트 저장됨");
      return;
    }

    await recordFunnelEvent(attemptId, currentStep.id, "advanced");
    await recordFunnelEvent(attemptId, nextStep.id, "entered");
    setStepIndex(stepIndex + 1);
  });

  const abandon = () => void run(async () => {
    if (stepIndex === null) return;
    await recordFunnelEvent(attemptId, signupSteps[stepIndex].id, "abandoned");
    setStepIndex(null);
    setAttemptId(createAttemptId());
    setStatus("이탈 이벤트 저장됨");
  });

  return (
    <section className="funnel-section" aria-labelledby="signup-funnel-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Internal analytics × Sentry trace</p>
          <h2 id="signup-funnel-title">가입 퍼널과 화면별 이탈률</h2>
        </div>
        <p>{status}</p>
      </div>

      <div className="funnel-layout">
        <div className="funnel-simulator" data-sentry-block>
          <ol className="funnel-progress" aria-label="가입 단계">
            {signupSteps.map((step, index) => (
              <li key={step.id} className={stepIndex === index ? "is-active" : ""}>
                <span>{index + 1}</span>{step.label}
              </li>
            ))}
          </ol>

          {stepIndex === null ? (
            <div className="funnel-screen">
              <strong>새 합성 가입 시도</strong>
              <p>실제 계좌·전화번호를 입력하지 않고 화면 진입과 이탈만 재현합니다.</p>
              <button type="button" disabled={isSubmitting} onClick={start}>가입 플로우 시작</button>
            </div>
          ) : (
            <div className="funnel-screen">
              <span>현재 화면</span>
              <strong>{signupSteps[stepIndex].label}</strong>
              <p>{signupSteps[stepIndex].description}</p>
              <div className="funnel-actions">
                <button type="button" disabled={isSubmitting} onClick={advance}>
                  {stepIndex === signupSteps.length - 1 ? "가입 완료" : "다음 화면"}
                </button>
                <button type="button" disabled={isSubmitting} onClick={abandon}>여기서 이탈</button>
              </div>
            </div>
          )}
        </div>

        <div className="funnel-summary" aria-label="가입 퍼널 집계">
          <div className="funnel-summary__total">
            <span>전체 가입 시도</span>
            <strong>{summary?.totalAttempts ?? 0}</strong>
            <small>완료 {summary?.completedAttempts ?? 0}</small>
          </div>
          <ol>
            {(summary?.steps ?? signupSteps.map((step) => ({
              ...step,
              reached: 0,
              dropOff: 0,
              dropOffRate: 0,
              conversionRate: 0,
            }))).map((step) => (
              <li key={step.id}>
                <div><strong>{step.label}</strong><span>도달 {step.reached}명</span></div>
                <div><span>이탈 {step.dropOff}명</span><strong>{step.dropOffRate}%</strong></div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
