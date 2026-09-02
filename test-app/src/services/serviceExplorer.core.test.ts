import { describe, expect, it } from "vitest";
import { buildServiceExplorerUrls } from "./serviceExplorer.core";

describe("서비스별 Sentry 탐색 주소", () => {
  it("service 태그와 프로젝트 범위를 모든 탐색 화면에 고정한다", () => {
    const urls = buildServiceExplorerUrls("http://127.0.0.1:9000/", "sentry", "2", "payment");
    expect(urls.issues).toContain("project=2");
    expect(urls.issues).toContain("service%3Apayment");
    expect(urls.logs).toContain("/explore/logs/");
    expect(urls.traces).toContain("/explore/traces/");
  });
});
