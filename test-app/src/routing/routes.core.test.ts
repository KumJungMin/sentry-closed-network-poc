import { describe, expect, it } from "vitest";
import {
  appRoutes,
  defaultAppPath,
  resolveInitialAppPath,
  signupFunnelStepPaths,
} from "./routes.core";

describe("app routes", () => {
  it("모든 기능에 서로 다른 절대 경로를 제공한다", () => {
    const paths = appRoutes.map(({ path }) => path);

    expect(paths).toHaveLength(10);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((path) => path.startsWith("/") && path !== "/")).toBe(true);
  });

  it("등록 경로의 후행 슬래시만 제거한다", () => {
    expect(resolveInitialAppPath("/custom-data/")).toBe("/custom-data");
    expect(resolveInitialAppPath("/service-errors///")).toBe("/service-errors");
  });

  it("가입 단계별 직접 URL을 보존한다", () => {
    expect(resolveInitialAppPath("/signup-funnel/terms")).toBe(signupFunnelStepPaths.terms);
    expect(resolveInitialAppPath("/signup-funnel/cdd/")).toBe(signupFunnelStepPaths.cdd);
  });

  it("루트와 알 수 없는 경로를 기본 수집 화면으로 보낸다", () => {
    expect(resolveInitialAppPath("/")).toBe(defaultAppPath);
    expect(resolveInitialAppPath("/unknown")).toBe(defaultAppPath);
  });
});
