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
const { createBatchProcessor, shouldSkipElement, translateExact } =
  context.SentryKoTranslatorCore;

test("Sentry의 정확히 일치하는 운영 문구만 번역한다", () => {
  assert.equal(translateExact("Issues", dictionary), "이슈");
  assert.equal(translateExact("  Session Replay  ", dictionary), "  세션 리플레이  ");
  assert.equal(translateExact("Customer Issues", dictionary), "Customer Issues");
});

test("모니터와 대시보드의 고정 UI만 번역하고 이벤트 데이터는 보존한다", () => {
  const expectedTranslations = {
    "All Monitors": "모든 모니터",
    "By Monitor Type": "모니터 유형별",
    "All Envs": "모든 환경",
    "Save as": "다른 이름으로 저장",
    Assignee: "담당자",
    Unhandled: "처리되지 않음",
    "Add Widget": "위젯 추가",
    "Total Errors": "전체 오류"
  };

  for (const [source, expected] of Object.entries(expectedTranslations)) {
    assert.equal(translateExact(source, dictionary), expected);
  }

  assert.equal(
    translateExact("[PoC] Unhandled JavaScript error", dictionary),
    "[PoC] Unhandled JavaScript error"
  );
  assert.equal(translateExact("frontend-poc", dictionary), "frontend-poc");
  assert.equal(translateExact("4d ago", dictionary), "4d ago");
});

test("사용자 지정 Tag와 Context는 표시값만 번역하고 저장되지 않은 값은 보존한다", () => {
  const expectedTranslations = {
    channel: "채널",
    service: "서비스",
    process_step: "처리 단계",
    error_code: "오류 코드",
    "hana-ez": "하나이지",
    remittance: "송금",
    "recipient-validation": "수취인 검증",
    RECIPIENT_VALIDATION_FAILED: "수취인 검증 실패"
  };

  for (const [source, expected] of Object.entries(expectedTranslations)) {
    assert.equal(translateExact(source, dictionary), expected);
  }

  assert.equal(translateExact("unknown-partner", dictionary), "unknown-partner");
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

test("DOM 작업을 제한된 개수로 나누고 같은 노드는 중복 등록하지 않는다", () => {
  const scheduled = [];
  const processed = [];
  const first = {};
  const second = {};
  const third = {};
  const processor = createBatchProcessor({
    maxBatchSize: 2,
    process: (value) => processed.push(value),
    schedule: (callback) => scheduled.push(callback)
  });

  processor.enqueue(first);
  processor.enqueue(first);
  processor.enqueue(second);
  processor.enqueue(third);

  assert.equal(scheduled.length, 1);
  scheduled.shift()();
  assert.deepEqual(processed, [first, second]);
  assert.equal(scheduled.length, 1);

  scheduled.shift()();
  assert.deepEqual(processed, [first, second, third]);
  assert.equal(scheduled.length, 0);
});
