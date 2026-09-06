import { isSignupStepId, type SignupStepId } from "./funnel.core";

const funnelSessionKey = "sentry-poc.signup-funnel.session.v1";
const attemptIdPattern = /^attempt_v1_[a-z0-9-]{12,64}$/u;

export interface FunnelSession {
  attemptId: string;
  furthestStep: SignupStepId;
}

export function readFunnelSession(storage: Pick<Storage, "getItem"> = sessionStorage): FunnelSession | null {
  try {
    const serialized = storage.getItem(funnelSessionKey);
    if (!serialized) return null;
    const candidate = JSON.parse(serialized) as Partial<FunnelSession>;
    const attemptId = candidate.attemptId;
    if (typeof attemptId !== "string"
      || !attemptIdPattern.test(attemptId)
      || !isSignupStepId(candidate.furthestStep)) {
      return null;
    }
    return { attemptId, furthestStep: candidate.furthestStep };
  } catch {
    return null;
  }
}

export function writeFunnelSession(
  session: FunnelSession,
  storage: Pick<Storage, "setItem"> = sessionStorage,
): void {
  storage.setItem(funnelSessionKey, JSON.stringify(session));
}

export function clearFunnelSession(storage: Pick<Storage, "removeItem"> = sessionStorage): void {
  storage.removeItem(funnelSessionKey);
}
