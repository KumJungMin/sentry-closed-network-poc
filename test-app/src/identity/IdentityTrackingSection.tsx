import { useMemo, useState } from "react";
import { activatePseudonymousIdentity, clearPseudonymousIdentity } from "./identityApi";

const sampleUuid = "123e4567-e89b-42d3-a456-426614174000";
const sentryBaseUrl = import.meta.env.VITE_SENTRY_BASE_URL?.trim() || "http://127.0.0.1:9000";
const sentryOrganization = import.meta.env.VITE_SENTRY_ORG?.trim() || "sentry";
const sentryProjectId = import.meta.env.VITE_SENTRY_PROJECT_ID?.trim() || "2";

interface IdentityTrackingSectionProps {
  onIdentityChange?: (pseudonymousId: string) => void;
}

export function IdentityTrackingSection({ onIdentityChange }: IdentityTrackingSectionProps) {
  const [userId, setUserId] = useState(sampleUuid);
  const [pseudonymousId, setPseudonymousId] = useState("");
  const [status, setStatus] = useState("합성 UUID만 사용하세요.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchUrls = useMemo(() => {
    if (!pseudonymousId) return null;
    const root = sentryBaseUrl.replace(/\/$/, "");
    const query = encodeURIComponent(`user.id:${pseudonymousId}`);
    const common = `project=${encodeURIComponent(sentryProjectId)}&query=${query}`;
    return {
      issues: `${root}/organizations/${sentryOrganization}/issues/?${common}`,
      replays: `${root}/organizations/${sentryOrganization}/explore/replays/?${common}`,
      traces: `${root}/organizations/${sentryOrganization}/explore/traces/?${common}`,
    };
  }, [pseudonymousId]);

  const activate = async () => {
    setIsSubmitting(true);
    try {
      const id = await activatePseudonymousIdentity(userId.trim());
      setPseudonymousId(id);
      onIdentityChange?.(id);
      setStatus("가명 ID가 현재 Sentry scope에 연결되었습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "가명 ID 연결 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clear = () => {
    clearPseudonymousIdentity();
    setPseudonymousId("");
    onIdentityChange?.("");
    setStatus("사용자 scope를 익명 상태로 되돌렸습니다.");
  };

  return (
    <section className="identity-section" aria-labelledby="identity-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Pseudonymous user journey</p>
          <h2 id="identity-title">특정 사용자 행동 추적</h2>
        </div>
        <p>원본 UUID는 망 내부 변환 요청에만 사용하고 Sentry에는 보내지 않습니다.</p>
      </div>
      <div className="identity-panel" data-sentry-block>
        <label htmlFor="synthetic-user-id">
          <span>합성 사용자 UUID</span>
          <input
            id="synthetic-user-id"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="identity-actions">
          <button type="button" disabled={isSubmitting} onClick={() => void activate()}>가명 ID 연결</button>
          <button type="button" disabled={!pseudonymousId} onClick={clear}>연결 해제</button>
        </div>
        <p role="status">{status}</p>
        {pseudonymousId && (
          <div className="identity-result">
            <span>Sentry 조회 ID</span>
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
