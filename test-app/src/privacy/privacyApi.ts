export interface PrivacyChallenge {
  challengeId: string;
  oneTimeCode: string;
  expiresAt: string;
  pocSyntheticDataOnly: true;
}

export interface PrivacySession {
  sessionToken: string;
  expiresAt: string;
}

export interface SyntheticPrivateProfile {
  pseudonymousId: string;
  synthetic: true;
  source: "synthetic-poc-adapter";
  name: string;
  phone: string;
  account: string;
  cddStatus: string;
}

async function parseOrThrow<Response>(response: globalThis.Response): Promise<Response> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(payload.message || "개인정보 조회 게이트 요청에 실패했습니다.");
  }
  return response.json() as Promise<Response>;
}

export async function requestPrivacyChallenge(
  pseudonymousId: string,
  reason: string,
  ticket: string,
): Promise<PrivacyChallenge> {
  return parseOrThrow(await fetch("/internal-api/privacy/challenges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pseudonymousId, reason, ticket }),
  }));
}

export async function verifyPrivacyChallenge(
  challengeId: string,
  code: string,
): Promise<PrivacySession> {
  return parseOrThrow(await fetch("/internal-api/privacy/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId, code }),
  }));
}

export async function fetchPrivateProfile(
  pseudonymousId: string,
  sessionToken: string,
): Promise<SyntheticPrivateProfile> {
  return parseOrThrow(await fetch(`/internal-api/privacy/users/${encodeURIComponent(pseudonymousId)}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  }));
}

export async function revokePrivacySession(sessionToken: string): Promise<void> {
  await fetch("/internal-api/privacy/sessions/current", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
}
