import { useMemo, useState } from "react";
import { activateCustomerIdentity, clearCustomerIdentity } from "./identityApi";

const sampleUuid = "123e4567-e89b-42d3-a456-426614174000";
const sentryBaseUrl = import.meta.env.VITE_SENTRY_BASE_URL?.trim() || "http://127.0.0.1:9000";
const sentryOrganization = import.meta.env.VITE_SENTRY_ORG?.trim() || "sentry";
const sentryProjectId = import.meta.env.VITE_SENTRY_PROJECT_ID?.trim() || "2";

interface IdentityTrackingSectionProps {
  onIdentityChange?: (pseudonymousId: string) => void;
}

export function IdentityTrackingSection({ onIdentityChange }: IdentityTrackingSectionProps) {
  const [userId, setUserId] = useState(sampleUuid);
  const [connectedCustomerId, setConnectedCustomerId] = useState("");
  const [pseudonymousId, setPseudonymousId] = useState("");
  const [status, setStatus] = useState("합성 UUID만 사용하세요.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchUrls = useMemo(() => {
    if (!connectedCustomerId) return null;
    const root = sentryBaseUrl.replace(/\/$/, "");
    const query = encodeURIComponent(`user.id:${connectedCustomerId}`);
    const common = `project=${encodeURIComponent(sentryProjectId)}&query=${query}`;
    return {
      issues: `${root}/organizations/${sentryOrganization}/issues/?${common}`,
      replays: `${root}/organizations/${sentryOrganization}/explore/replays/?${common}`,
      traces: `${root}/organizations/${sentryOrganization}/explore/traces/?${common}`,
    };
  }, [connectedCustomerId]);

  const activate = async () => {
    setIsSubmitting(true);
    try {
      const identity = await activateCustomerIdentity(userId);
      setConnectedCustomerId(identity.customerId);
      setPseudonymousId(identity.pseudonymousId);
      onIdentityChange?.(identity.pseudonymousId);
      setStatus("원본 고객 ID가 현재 Sentry scope에 연결되었습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "고객 ID 연결 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clear = () => {
    clearCustomerIdentity();
    setConnectedCustomerId("");
    setPseudonymousId("");
    onIdentityChange?.("");
    setStatus("사용자 scope를 익명 상태로 되돌렸습니다.");
  };

  return (
    <section className="identity-section" aria-labelledby="identity-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Identified user journey</p>
          <h2 id="identity-title">특정 사용자 행동 추적</h2>
        </div>
        <p>원본 고객 ID를 Sentry의 user.id에 연결하고, 다른 사용자 개인정보는 계속 제거합니다.</p>
      </div>
      <div className="identity-panel" data-sentry-block>
        <label htmlFor="synthetic-user-id">
          <span>원본 고객 ID (PoC에서는 합성 UUID)</span>
          <input
            id="synthetic-user-id"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="identity-actions">
          <button type="button" disabled={isSubmitting} onClick={() => void activate()}>고객 ID 연결</button>
          <button type="button" disabled={!connectedCustomerId} onClick={clear}>연결 해제</button>
        </div>
        <p role="status">{status}</p>
        {connectedCustomerId && (
          <div className="identity-result">
            <span>Sentry 조회 ID (원본 고객 ID)</span>
            <code>{connectedCustomerId}</code>
            <span>내부 분석 ID (HMAC)</span>
            <code>{pseudonymousId}</code>
            <nav aria-label="사용자 행동 조회">
              <a href={searchUrls?.issues} target="_blank" rel="noreferrer">Issues</a>
              <a href={searchUrls?.replays} target="_blank" rel="noreferrer">Replays</a>
              <a href={searchUrls?.traces} target="_blank" rel="noreferrer">Traces</a>
            </nav>
          </div>
        )}
      </div>
    </section>
  );
}
