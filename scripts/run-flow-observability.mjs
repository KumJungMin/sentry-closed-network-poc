import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [
  spawn(process.execPath, [resolve(repositoryRoot, "internal-observability/server.mjs")], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
  }),
  spawn(process.execPath, [resolve(repositoryRoot, "scripts/publish-domain-flow-snapshots.mjs"), "--watch"], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
  }),
];

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

for (const child of children) {
  child.once("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
    stop();
  });
  child.once("exit", (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`관측 하위 프로세스가 비정상 종료됐습니다: code=${code}, signal=${signal}`);
      process.exitCode = code ?? 1;
      stop();
    }
  });
}
