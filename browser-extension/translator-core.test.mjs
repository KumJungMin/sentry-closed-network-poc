import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({});
const directory = new URL("./", import.meta.url);

for (const filename of ["dictionary.js", "translator-core.js"]) {
  const source = await readFile(new URL(filename, directory), "utf8");
  vm.runInContext(source, context, { filename });
}

const dictionary = context.SENTRY_KO_TRANSLATIONS;
const { shouldSkipElement, translateExact } = context.SentryKoTranslatorCore;

test("Sentry의 정확히 일치하는 운영 문구만 번역한다", () => {
  assert.equal(translateExact("Issues", dictionary), "이슈");
  assert.equal(translateExact("  Session Replay  ", dictionary), "  세션 리플레이  ");
  assert.equal(translateExact("Customer Issues", dictionary), "Customer Issues");
});

test("코드와 입력 영역은 번역 대상에서 제외한다", () => {
  assert.equal(
    shouldSkipElement({
      tagName: "CODE",
      isContentEditable: false,
      closest: () => null
    }),
    true
  );
  assert.equal(
    shouldSkipElement({
      tagName: "DIV",
      isContentEditable: false,
      closest: () => null
    }),
    false
  );
});
