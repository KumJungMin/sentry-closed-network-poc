import { createServer } from "node:http";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateFunnel,
  DEFAULT_FUNNEL_DROPOFF_GRACE_PERIOD_MS,
  normalizeAnalyticsEvent,
} from "./analytics-core.mjs";
import { pseudonymizeUserId } from "./identity-core.mjs";
import { PrivacyGate, buildSyntheticProfile } from "./privacy-gate.mjs";
import { calculateNormalizedErrorRanking, normalizeUsageEvent } from "./usage-core.mjs";

const port = Number(process.env.INTERNAL_OBSERVABILITY_PORT || 4318);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = resolve(repositoryRoot, ".runtime", "internal-observability");
const eventFile = resolve(dataDirectory, "analytics-events.ndjson");
const privacyAuditFile = resolve(dataDirectory, "privacy-audit.ndjson");
const usageEventFile = resolve(dataDirectory, "usage-events.ndjson");
const identityHmacSecret = process.env.IDENTITY_HMAC_SECRET || "local-poc-identity-secret-v1";
const configuredDropOffGracePeriodMs = Number(process.env.FUNNEL_DROPOFF_GRACE_PERIOD_MS);
const funnelDropOffGracePeriodMs = Number.isFinite(configuredDropOffGracePeriodMs)
  && configuredDropOffGracePeriodMs >= 0
  ? configuredDropOffGracePeriodMs
  : DEFAULT_FUNNEL_DROPOFF_GRACE_PERIOD_MS;

await mkdir(dataDirectory, { recursive: true });

async function loadEventsFrom(file) {
  try {
    const content = await readFile(file, "utf8");
    return content.split("\n").filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

const events = await loadEventsFrom(eventFile);
const usageEvents = await loadEventsFrom(usageEventFile);
const privacyAuditEvents = [];
const privacyGate = new PrivacyGate({
  audit: (event) => {
    const auditEvent = { ...event, occurredAt: new Date().toISOString() };
    privacyAuditEvents.push(auditEvent);
    void appendFile(privacyAuditFile, `${JSON.stringify(auditEvent)}\n`, { mode: 0o600 });
  },
});

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw new Error("요청 본문이 너무 큽니다.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", storedEvents: events.length });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/analytics/funnel") {
      sendJson(response, 200, {
        generatedAt: new Date().toISOString(),
        ...calculateFunnel(events, { dropOffGracePeriodMs: funnelDropOffGracePeriodMs }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/analytics/events") {
      const event = normalizeAnalyticsEvent(await readJson(request));
      events.push(event);
      await appendFile(eventFile, `${JSON.stringify(event)}\n`, { mode: 0o600 });
      sendJson(response, 202, { accepted: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/analytics/usage") {
      const usageEvent = normalizeUsageEvent(await readJson(request));
      usageEvents.push(usageEvent);
      await appendFile(usageEventFile, `${JSON.stringify(usageEvent)}\n`, { mode: 0o600 });
      sendJson(response, 202, { accepted: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/analytics/normalized") {
      sendJson(response, 200, {
        generatedAt: new Date().toISOString(),
        errorRanking: calculateNormalizedErrorRanking(usageEvents),
        funnel: calculateFunnel(events, { dropOffGracePeriodMs: funnelDropOffGracePeriodMs }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/identity/pseudonymize") {
      const input = await readJson(request);
      const pseudonymousId = pseudonymizeUserId(input.userId, identityHmacSecret);
      sendJson(response, 200, { pseudonymousId });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/privacy/challenges") {
      const challenge = privacyGate.requestAccess(await readJson(request));
      sendJson(response, 201, { ...challenge, pocSyntheticDataOnly: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/privacy/sessions") {
      sendJson(response, 201, privacyGate.verifyChallenge(await readJson(request)));
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/privacy/users/")) {
      const pseudonymousId = decodeURIComponent(url.pathname.slice("/api/privacy/users/".length));
      const sessionToken = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      privacyGate.authorize(sessionToken, pseudonymousId);
      sendJson(response, 200, buildSyntheticProfile(pseudonymousId));
      return;
    }

    if (request.method === "DELETE" && url.pathname === "/api/privacy/sessions/current") {
      const sessionToken = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      privacyGate.revoke(sessionToken);
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/privacy/audit") {
      sendJson(response, 200, { events: privacyAuditEvents.slice(-20).reverse() });
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    sendJson(response, 400, {
      error: "invalid_request",
      message: error instanceof Error ? error.message : "요청을 처리할 수 없습니다.",
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[internal-observability] http://127.0.0.1:${port}`);
});
