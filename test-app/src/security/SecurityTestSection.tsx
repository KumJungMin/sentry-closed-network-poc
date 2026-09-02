import { useSecurityTest } from "./useSecurityTest";

interface SecurityTestSectionProps {
  environment: string;
  isSentryEnabled: boolean;
}

const protectedDataGroups = [
  "이름 · 전화번호 · 이메일",
  "계좌번호 · 주민등록번호 · CI",
  "OTP · 인증코드",
  "Access/Refresh Token",
  "Authorization · Cookie",
  "송금인 · 수취인 정보",
  "API 요청/응답 원문",
  "전체 입력 폼 · 거래 식별자",
] as const;

export function SecurityTestSection({ environment, isSentryEnabled }: SecurityTestSectionProps) {
  const { isSubmitting, result, submit } = useSecurityTest(isSentryEnabled);

  return (
    <section className="security-section" aria-labelledby="security-test-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Phase 7 · Privacy by default</p>
          <h2 id="security-test-title">민감정보 비수집 검증</h2>
        </div>
        <p>합성 데이터만 주입하고, SDK 전송 직전 필터와 서버 스크러빙 결과를 확인합니다.</p>
      </div>

      <div className="security-layout">
        <div className="security-test-card">
          <div className="security-policy-summary" aria-label="현재 보안 정책">
            <span>Environment <strong>{environment}</strong></span>
            <span>Default PII <strong>OFF</strong></span>
            <span>Session Replay <strong>OFF</strong></span>
            <span>Query string <strong>제거</strong></span>
          </div>

          <div className="security-synthetic-notice">
            <strong>실제 개인정보를 입력하지 마세요.</strong>
            <p>`example.invalid`와 `FAKE-*`로 표시된 고정 합성값만 코드에서 전송합니다.</p>
          </div>

          {result && (
            <div className={`custom-data-feedback custom-data-feedback--${result.tone}`} role="status">
              <strong>{result.summary}</strong>
              <span>{result.detail}</span>
            </div>
          )}

          <button
            className="custom-data-submit"
            type="button"
            disabled={!isSentryEnabled || isSubmitting}
            onClick={() => void submit()}
          >
            {!isSentryEnabled
              ? "SDK 연결 필요"
              : isSubmitting ? "필터링 후 전송 중…" : "합성 민감정보 이벤트 전송"}
          </button>
        </div>

        <aside className="security-protected-card" aria-label="비수집 대상">
          <h3>저장하면 안 되는 데이터</h3>
          <ul>{protectedDataGroups.map((group) => <li key={group}>{group}</li>)}</ul>
          <p>익명화된 `anon-*` 사용자 ID만 허용하고 나머지 사용자 식별자는 제거합니다.</p>
        </aside>
      </div>
    </section>
  );
}
