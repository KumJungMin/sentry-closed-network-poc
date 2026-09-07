import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSnapshotSpanOptions,
  normalizeFlowSummary,
  resolveSnapshotInterval,
} from "./snapshot-publisher-core.mjs";

const membershipSummary = {
  flowName: "membership",
  flowVersion: 1,
  service: "frontend-membership",
  dropOffGracePeriodMs: 1_800_000,
  totalAttempts: 3,
  completedAttempts: 1,
  steps: [
    { id: "terms", index: 1, label: "약관 동의", display: "01. 약관 동의", path: "/signup/terms", reached: 3, progressed: 2, dropOff: 1, pendingDropOff: 0, dropOffRate: 33.3, conversionRate: 66.7 },
    { id: "account", index: 2, label: "계정 정보", display: "02. 계정 정보", path: "/signup/account", reached: 2, progressed: 1, dropOff: 1, pendingDropOff: 0, dropOffRate: 50, conversionRate: 33.3 },
    { id: "phone", index: 3, label: "휴대폰 인증", display: "03. 휴대폰 인증", path: "/signup/phone", reached: 1, progressed: 1, dropOff: 0, pendingDropOff: 0, dropOffRate: 0, conversionRate: 33.3 },
    { id: "identity", index: 4, label: "본인 확인", display: "04. 본인 확인", path: "/signup/identity", reached: 1, progressed: 1, dropOff: 0, pendingDropOff: 0, dropOffRate: 0, conversionRate: 33.3 },
    { id: "result", index: 5, label: "가입 완료", display: "05. 가입 완료", path: "/signup/complete", reached: 1, progressed: 1, dropOff: 0, pendingDropOff: 0, dropOffRate: 0, conversionRate: 33.3 },
  ],
};

test("publisher 주기를 5초 이상으로 제한한다", () => {
  assert.equal(resolveSnapshotInterval("10000"), 10_000);
  assert.equal(resolveSnapshotInterval("1000"), 60_000);
  assert.equal(resolveSnapshotInterval("invalid"), 60_000);
});

test("예상 플로우와 단계 수가 일치하는 집계만 허용한다", () => {
  assert.deepEqual(normalizeFlowSummary(membershipSummary, "membership"), membershipSummary);
  assert.throws(
    () => normalizeFlowSummary({ ...membershipSummary, flowName: "payment" }, "membership"),
    /이름이 올바르지 않습니다/u,
  );
});

test("집계 서버가 단계 표시 속성을 누락해도 publisher가 보정한다", () => {
  const legacySummary = {
    ...membershipSummary,
    steps: membershipSummary.steps.map(({ index: _index, display: _display, ...step }) => step),
  };
  const normalized = normalizeFlowSummary(legacySummary, "membership");

  assert.equal(normalized.steps[0].index, 1);
  assert.equal(normalized.steps[0].display, "01. 약관 동의");
  assert.equal(normalized.steps[1].index, 2);
  assert.equal(normalized.steps[1].display, "02. 계정 정보");
});

test("고객 식별자 없이 정확 집계 span 속성을 만든다", () => {
  const options = buildSnapshotSpanOptions(
    membershipSummary,
    membershipSummary.steps[0],
    new Date("2026-09-07T00:00:00.000Z"),
  );

  assert.equal(options.op, "poc.flow.snapshot");
  assert.equal(options.attributes["flow.step_index"], 1);
  assert.equal(options.attributes["flow.step_display"], "01. 약관 동의");
  assert.equal(options.attributes["flow.page_path"], "/signup/terms");
  assert.equal(options.attributes["flow.drop_off"], 1);
  assert.equal(options.attributes["flow.drop_off_rate"], 33.3);
  assert.equal(options.attributes["snapshot.published_at"], "2026-09-07T00:00:00.000Z");
  assert.equal(JSON.stringify(options).includes("user"), false);
});
