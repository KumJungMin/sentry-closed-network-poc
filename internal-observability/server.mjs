import { createServer } from "node:http";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateFunnel, normalizeAnalyticsEvent } from "./analytics-core.mjs";

const port = Number(process.env.INTERNAL_OBSERVABILITY_PORT || 4318);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = resolve(repositoryRoot, ".runtime", "internal-observability");
const eventFile = resolve(dataDirectory, "analytics-events.ndjson");

await mkdir(dataDirectory, { recursive: true });

async function loadEvents() {
  try {
    const content = await readFile(eventFile, "utf8");
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

const events = await loadEvents();

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
      sendJson(response, 200, { generatedAt: new Date().toISOString(), ...calculateFunnel(events) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/analytics/events") {
      const event = normalizeAnalyticsEvent(await readJson(request));
      events.push(event);
      await appendFile(eventFile, `${JSON.stringify(event)}\n`, { mode: 0o600 });
      sendJson(response, 202, { accepted: true });
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
