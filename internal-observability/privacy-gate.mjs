import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const pseudonymousIdPattern = /^dbg_v1_[A-Za-z0-9_-]{20,80}$/;
const ticketPattern = /^[A-Z][A-Z0-9_-]{1,15}-\d{1,10}$/;

function hashCode(challengeId, code) {
  return createHash("sha256").update(`${challengeId}:${code}`).digest();
}

export class PrivacyGate {
  constructor({
    now = () => Date.now(),
    createId = () => randomBytes(18).toString("base64url"),
    createCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
    audit = () => {},
  } = {}) {
    this.now = now;
    this.createId = createId;
    this.createCode = createCode;
    this.audit = audit;
    this.challenges = new Map();
    this.sessions = new Map();
  }

  requestAccess({ pseudonymousId, reason, ticket }) {
    if (!pseudonymousIdPattern.test(pseudonymousId ?? "")) throw new Error("승인된 가명 사용자 ID가 필요합니다.");
    if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 200) {
      throw new Error("조회 사유를 10~200자로 입력하세요.");
    }
    if (!ticketPattern.test(ticket ?? "")) throw new Error("승인 티켓 형식이 올바르지 않습니다.");

    const challengeId = this.createId();
    const oneTimeCode = this.createCode();
    const expiresAt = this.now() + 5 * 60_000;
    this.challenges.set(challengeId, {
      pseudonymousId,
      reason: reason.trim(),
      ticket,
      codeHash: hashCode(challengeId, oneTimeCode),
      attempts: 0,
      expiresAt,
      used: false,
    });
    this.audit({ action: "challenge_requested", pseudonymousId, reason: reason.trim(), ticket });
    return { challengeId, oneTimeCode, expiresAt: new Date(expiresAt).toISOString() };
  }

  verifyChallenge({ challengeId, code }) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.used) throw new Error("유효하지 않거나 이미 사용한 인증 요청입니다.");
    if (challenge.expiresAt <= this.now()) throw new Error("인증번호가 만료되었습니다.");
    if (challenge.attempts >= 5) throw new Error("인증번호 시도 횟수를 초과했습니다.");

    challenge.attempts += 1;
    const suppliedHash = hashCode(challengeId, String(code ?? ""));
    if (!timingSafeEqual(challenge.codeHash, suppliedHash)) {
      this.audit({ action: "challenge_failed", pseudonymousId: challenge.pseudonymousId, ticket: challenge.ticket });
      throw new Error("인증번호가 일치하지 않습니다.");
    }

    challenge.used = true;
    const sessionToken = this.createId();
    const expiresAt = this.now() + 10 * 60_000;
    this.sessions.set(sessionToken, {
      pseudonymousId: challenge.pseudonymousId,
      reason: challenge.reason,
      ticket: challenge.ticket,
      expiresAt,
    });
    this.audit({ action: "session_granted", pseudonymousId: challenge.pseudonymousId, ticket: challenge.ticket });
    return { sessionToken, expiresAt: new Date(expiresAt).toISOString() };
  }

  authorize(sessionToken, pseudonymousId) {
    const session = this.sessions.get(sessionToken);
    if (!session || session.expiresAt <= this.now()) throw new Error("조회 세션이 없거나 만료되었습니다.");
    if (session.pseudonymousId !== pseudonymousId) throw new Error("다른 사용자의 조회 권한으로 접근할 수 없습니다.");
    this.audit({ action: "profile_viewed", pseudonymousId, ticket: session.ticket });
    return session;
  }

  revoke(sessionToken) {
    const session = this.sessions.get(sessionToken);
    if (!session) return;
    this.sessions.delete(sessionToken);
    this.audit({ action: "session_revoked", pseudonymousId: session.pseudonymousId, ticket: session.ticket });
  }
}

export function buildSyntheticProfile(pseudonymousId) {
  return {
    pseudonymousId,
    synthetic: true,
    source: "synthetic-poc-adapter",
    name: "합성 고객 홍길동",
    phone: "010-0000-1234",
    account: "000-0000-0000-01",
    cddStatus: "VERIFIED",
  };
}
