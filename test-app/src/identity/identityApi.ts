import * as Sentry from "@sentry/react";
import { recordIdentifiedUserBehavior } from "../sentry/dashboardTelemetry";
import { isPseudonymousDebugId } from "./identity.core";

export interface ActivatedCustomerIdentity {
  customerId: string;
  pseudonymousId: string;
}

export async function activateCustomerIdentity(customerId: string): Promise<ActivatedCustomerIdentity> {
  const normalizedCustomerId = customerId.trim();
  if (!normalizedCustomerId) throw new Error("고객 ID를 입력하세요.");

  const pseudonymousId = await requestPseudonymousId(normalizedCustomerId);
  Sentry.setUser({ id: normalizedCustomerId });
  Sentry.setTag("identity_mode", "raw_customer_id");
  Sentry.addBreadcrumb({
    category: "identity",
    level: "info",
    message: "customer_identity_activated",
  });
  recordIdentifiedUserBehavior("identity_activated", normalizedCustomerId);
  return { customerId: normalizedCustomerId, pseudonymousId };
}

export function clearCustomerIdentity(): void {
  const customerId = Sentry.getCurrentScope().getUser()?.id;
  if (customerId !== undefined) recordIdentifiedUserBehavior("identity_cleared", String(customerId));
  Sentry.setUser(null);
  Sentry.setTag("identity_mode", "anonymous");
}

async function requestPseudonymousId(userId: string): Promise<string> {
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

  return payload.pseudonymousId;
}
