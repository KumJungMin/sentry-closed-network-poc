import { useEffect, useRef, useState } from "react";
import { recordPrivacyDashboardState } from "../sentry/dashboardTelemetry";
import {
  fetchPrivateProfile,
  requestPrivacyChallenge,
  revokePrivacySession,
  verifyPrivacyChallenge,
  type PrivacyChallenge,
  type PrivacySession,
  type SyntheticPrivateProfile,
} from "./privacyApi";

interface PrivacyAccessSectionProps {
  pseudonymousId: string;
}

export function PrivacyAccessSection({ pseudonymousId }: PrivacyAccessSectionProps) {
  const [reason, setReason] = useState("장애 재현을 위한 합성 고객 상태 확인");
  const [ticket, setTicket] = useState("POC-1001");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<PrivacyChallenge | null>(null);
  const [session, setSession] = useState<PrivacySession | null>(null);
  const [profile, setProfile] = useState<SyntheticPrivateProfile | null>(null);
  const [status, setStatus] = useState("가명 ID 연결 후 조회 승인을 요청하세요.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sessionTokenRef = useRef("");

  const requestAccess = async () => {
    setIsSubmitting(true);
    try {
      const nextChallenge = await requestPrivacyChallenge(pseudonymousId, reason, ticket);
      setChallenge(nextChallenge);
      setCode(nextChallenge.oneTimeCode);
      recordPrivacyDashboardState("challenge_requested", false);
      setStatus("PoC 일회용 인증번호가 발급되었습니다. 운영에서는 별도 인증 채널로 전송합니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "조회 승인 요청 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verify = async () => {
    if (!challenge) return;
    setIsSubmitting(true);
    try {
      const nextSession = await verifyPrivacyChallenge(challenge.challengeId, code);
      let nextProfile: SyntheticPrivateProfile;
      try {
        nextProfile = await fetchPrivateProfile(pseudonymousId, nextSession.sessionToken);
      } catch (error) {
        await revokePrivacySession(nextSession.sessionToken);
        throw error;
      }
      setSession(nextSession);
      sessionTokenRef.current = nextSession.sessionToken;
      setProfile(nextProfile);
      recordPrivacyDashboardState("access_opened", true);
      setStatus("10분 JIT 조회 세션이 열렸습니다. 조회 행위는 별도 감사 로그에 남습니다.");
    } catch (error) {
      recordPrivacyDashboardState("access_denied", false);
      setStatus(error instanceof Error ? error.message : "인증번호 확인 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  const close = async () => {
    if (session) await revokePrivacySession(session.sessionToken);
    sessionTokenRef.current = "";
    setSession(null);
    setProfile(null);
    setChallenge(null);
    setCode("");
    recordPrivacyDashboardState("access_revoked", false);
    setStatus("개인정보 조회 세션을 종료했습니다.");
  };

  useEffect(() => () => {
    if (sessionTokenRef.current) void revokePrivacySession(sessionTokenRef.current);
  }, []);

  return (
    <section className="privacy-section" aria-labelledby="privacy-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Outside Sentry · JIT access</p>
          <h2 id="privacy-title">개인정보 ON/OFF 조회 게이트</h2>
        </div>
        <p>Sentry에는 개인정보 원문과 조회 token을 절대 전송하지 않습니다.</p>
      </div>
      <div className="privacy-gate" data-private>
        <div className="privacy-gate__form">
          <label htmlFor="privacy-user"><span>가명 사용자 ID</span><input id="privacy-user" value={pseudonymousId} readOnly placeholder="먼저 가명 ID를 연결하세요" /></label>
          <label htmlFor="privacy-reason"><span>조회 사유</span><input id="privacy-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <label htmlFor="privacy-ticket"><span>승인 티켓</span><input id="privacy-ticket" value={ticket} onChange={(event) => setTicket(event.target.value.toUpperCase())} /></label>
          {!challenge ? (
            <button type="button" disabled={!pseudonymousId || isSubmitting} onClick={() => void requestAccess()}>조회 승인 요청</button>
          ) : !session ? (
            <>
              <label htmlFor="privacy-code"><span>일회용 인증번호</span><input id="privacy-code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" /></label>
              <button type="button" disabled={isSubmitting} onClick={() => void verify()}>10분 조회 열기</button>
            </>
          ) : (
            <button type="button" onClick={() => void close()}>즉시 조회 종료</button>
          )}
          <p role="status">{status}</p>
        </div>

        <div className={`privacy-profile ${profile ? "is-open" : ""}`}>
          <span>{profile ? "개인정보 ON · 합성 데이터" : "개인정보 OFF"}</span>
          {profile ? (
            <dl>
              <div><dt>이름</dt><dd>{profile.name}</dd></div>
              <div><dt>휴대폰</dt><dd>{profile.phone}</dd></div>
              <div><dt>계좌</dt><dd>{profile.account}</dd></div>
              <div><dt>CDD</dt><dd>{profile.cddStatus}</dd></div>
            </dl>
          ) : <p>승인된 단기 세션이 없으므로 원문을 표시하지 않습니다.</p>}
        </div>
      </div>
    </section>
  );
}
