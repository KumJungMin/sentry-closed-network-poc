import { createHmac } from "node:crypto";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function pseudonymizeUserId(rawUserId, secret) {
  if (!uuidPattern.test(rawUserId ?? "")) throw new Error("UUID 형식의 사용자 ID가 필요합니다.");
  if (typeof secret !== "string" || secret.length < 16) throw new Error("ID HMAC secret은 16자 이상이어야 합니다.");

  const digest = createHmac("sha256", secret)
    .update(rawUserId.toLowerCase())
    .digest("base64url");
  return `dbg_v1_${digest}`;
}
