import {
  formatDropOffGracePeriod,
  signupSteps,
  type SignupStepId,
} from "./funnel.core";
import { useSignupFunnel } from "./useSignupFunnel";

interface SignupFunnelSectionProps {
  currentStep?: SignupStepId;
}

export function SignupFunnelSection({ currentStep = undefined }: SignupFunnelSectionProps) {
  const funnel = useSignupFunnel(currentStep ?? null);
  const selectedStep = signupSteps.find(({ id }) => id === funnel.currentStep) ?? null;
  const gracePeriodLabel = formatDropOffGracePeriod(
    funnel.summary?.dropOffGracePeriodMs ?? 30 * 60 * 1000,
  );

  return (
    <section className="funnel-section" aria-labelledby="signup-funnel-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Internal analytics × Sentry trace</p>
          <h2 id="signup-funnel-title">가입 퍼널과 화면별 이탈률</h2>
        </div>
        <p>{funnel.status}</p>
      </div>

      <div className="funnel-layout">
        <div className="funnel-simulator" data-sentry-block>
          <ol className="funnel-progress" aria-label="가입 단계">
            {signupSteps.map((step, index) => (
              <li key={step.id} className={funnel.currentStep === step.id ? "is-active" : ""}>
                <span>{index + 1}</span>{step.label}
              </li>
            ))}
          </ol>

          {selectedStep === null ? (
            <div className="funnel-screen">
              <strong>새 가입 시도 만들기</strong>
              <p>각 가입 단계는 고유 URL을 사용하며, 화면 진입이 자동으로 pageView로 기록됩니다.</p>
              <button type="button" disabled={funnel.isSubmitting} onClick={funnel.start}>
                가입 시작
              </button>
            </div>
          ) : (
            <div className="funnel-screen">
              <span>현재 화면</span>
              <strong>{selectedStep.label}</strong>
              <code>/signup-funnel/{selectedStep.id}</code>
              <p>{selectedStep.description}</p>
              {funnel.pageViewError && (
                <button type="button" disabled={funnel.isSubmitting} onClick={funnel.retryPageView}>
                  화면 진입 다시 기록
                </button>
              )}
              <div className="funnel-actions">
                <button
                  type="button"
                  disabled={funnel.isSubmitting || !funnel.isPageViewReady}
                  onClick={funnel.advance}
                >
                  {selectedStep.id === "cdd" ? "가입 완료" : "다음 화면"}
                </button>
                <button
                  type="button"
                  disabled={funnel.isSubmitting || !funnel.isPageViewReady}
                  onClick={funnel.abandon}
                >
                  여기서 이탈
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="funnel-summary" aria-label="가입 퍼널 집계">
          <div className="funnel-summary__total">
            <span>전체 가입 시도</span>
            <strong>{funnel.summary?.totalAttempts ?? 0}</strong>
            <small>완료 {funnel.summary?.completedAttempts ?? 0}</small>
          </div>
          <p className="funnel-summary__policy">
            다음 pageView가 없으면 {gracePeriodLabel} 이탈 확정으로 집계합니다.
          </p>
          <ol>
            {(funnel.summary?.steps ?? signupSteps.map((step) => ({
              ...step,
              reached: 0,
              dropOff: 0,
              pendingDropOff: 0,
              dropOffRate: 0,
              conversionRate: 0,
            }))).map((step) => (
              <li key={step.id}>
                <div><strong>{step.label}</strong><span>도달 {step.reached}명</span></div>
                <div><span>이탈 확정 {step.dropOff}명</span><strong>{step.dropOffRate}%</strong></div>
                <div><span>이탈 판단 대기</span><strong>{step.pendingDropOff}명</strong></div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
