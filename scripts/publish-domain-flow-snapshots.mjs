import * as Sentry from "@sentry/node";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSnapshotSpanOptions,
  normalizeFlowSummary,
  resolveSnapshotInterval,
  SNAPSHOT_FLOW_NAMES,
} from "../internal-observability/snapshot-publisher-core.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");
const analyticsBaseUrl = process.env.INTERNAL_OBSERVABILITY_URL || "http://127.0.0.1:4318";
const flowAppNames = {
  membership: "membership-web",
  remittance: "remittance-web",
  payment: "payment-web",
};

function readFlowArgument() {
  const index = process.argv.indexOf("--flow");
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function waitForAnalyticsServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${analyticsBaseUrl}/health`);
      if (response.ok) return;
    } catch {
      // 집계 서버가 뜨는 짧은 시간 동안 재시도한다.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("내부 집계 서버가 10초 안에 준비되지 않았습니다.");
}

async function publishFlow(flowName) {
  if (!SNAPSHOT_FLOW_NAMES.includes(flowName)) throw new Error("유효하지 않은 플로우 이름입니다.");
  const dsn = process.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) throw new Error(`${flowName} Sentry DSN이 없습니다.`);
  const response = await fetch(
    `${analyticsBaseUrl}/api/analytics/funnel?flowName=${encodeURIComponent(flowName)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`플로우 집계 조회가 HTTP ${response.status}로 실패했습니다.`);
  const summary = normalizeFlowSummary(await response.json(), flowName);

  Sentry.init({
    dsn,
    environment: process.env.VITE_SENTRY_ENVIRONMENT || "local",
    release: process.env.VITE_APP_RELEASE || `${flowAppNames[flowName]}@local`,
    tracesSampleRate: 1,
    sendDefaultPii: false,
  });
  for (const step of summary.steps) {
    const span = Sentry.startInactiveSpan(buildSnapshotSpanOptions(summary, step));
    span.end();
  }
  if (!await Sentry.flush(5_000)) throw new Error(`${flowName} snapshot 전송 제한 시간을 초과했습니다.`);
  await Sentry.close(5_000);
  console.log(`정확 집계 snapshot 발행 완료: ${flowName} (${summary.steps.length}개 단계)`);
}

function runFlowChild(flowName) {
  const appName = flowAppNames[flowName];
  const envFile = resolve(repositoryRoot, "apps", appName, ".env.local");
  if (!existsSync(envFile)) {
    throw new Error(`환경 파일이 없습니다: apps/${appName}/.env.local`);
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [`--env-file=${envFile}`, scriptPath, "--flow", flowName],
      { cwd: repositoryRoot, stdio: "inherit", env: process.env },
    );
    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${flowName} snapshot publisher가 코드 ${code}로 종료됐습니다.`));
    });
  });
}

async function publishAllFlows() {
  await waitForAnalyticsServer();
  for (const flowName of SNAPSHOT_FLOW_NAMES) await runFlowChild(flowName);
}

async function main() {
  const flowName = readFlowArgument();
  if (flowName) {
    await publishFlow(flowName);
    return;
  }

  await publishAllFlows();
  if (!process.argv.includes("--watch")) return;
  const intervalMs = resolveSnapshotInterval(process.env.FLOW_SNAPSHOT_INTERVAL_MS);
  console.log(`정확 집계 snapshot 주기 발행 시작: ${intervalMs}ms`);
  setInterval(() => {
    void publishAllFlows().catch((error) => console.error(error instanceof Error ? error.message : error));
  }, intervalMs);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
