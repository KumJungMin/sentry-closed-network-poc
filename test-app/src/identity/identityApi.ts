import * as Sentry from "@sentry/react";
import { isPseudonymousDebugId } from "./identity.core";

export async function activatePseudonymousIdentity(userId: string): Promise<string> {
  const response = await fetch("/internal-api/identity/pseudonymize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) throw new Error("가명 사용자 ID 발급에 실패했습니다.");

  const payload = await response.json() as { pseudonymousId?: string };
  if (!payload.pseudonymousId || !isPseudonymousDebugId(payload.pseudonymousId)) {
    throw new Error("허용되지 않은 가명 사용자 ID입니다.");
  }

  Sentry.setUser({ id: payload.pseudonymousId });
  Sentry.setTag("identity_mode", "pseudonymous");
  Sentry.addBreadcrumb({
    category: "identity",
    level: "info",
    message: "pseudonymous_debug_identity_activated",
  });
  return payload.pseudonymousId;
}

export function clearPseudonymousIdentity(): void {
  Sentry.setUser(null);
  Sentry.setTag("identity_mode", "anonymous");
}
