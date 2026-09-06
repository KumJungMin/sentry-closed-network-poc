import type { SignupStepId } from "../signup-funnel/funnel.core";

export const appRoutePaths = {
  collection: "/collection",
  customData: "/custom-data",
  signupFunnel: "/signup-funnel",
  logs: "/logs",
  serviceErrors: "/service-errors",
  identity: "/identity",
  privacy: "/privacy",
  metrics: "/metrics",
  security: "/security",
  executionLog: "/execution-log",
} as const;

export const signupFunnelStepPaths: Readonly<Record<SignupStepId, string>> = {
  terms: `${appRoutePaths.signupFunnel}/terms`,
  account: `${appRoutePaths.signupFunnel}/account`,
  phone: `${appRoutePaths.signupFunnel}/phone`,
  cdd: `${appRoutePaths.signupFunnel}/cdd`,
};

export type AppRouteId = keyof typeof appRoutePaths;

export interface AppRouteDefinition {
  id: AppRouteId;
  path: string;
  label: string;
}

export const appRoutes: readonly AppRouteDefinition[] = [
  { id: "collection", path: appRoutePaths.collection, label: "수집 테스트" },
  { id: "customData", path: appRoutePaths.customData, label: "커스텀 데이터" },
  { id: "signupFunnel", path: appRoutePaths.signupFunnel, label: "가입 퍼널" },
  { id: "logs", path: appRoutePaths.logs, label: "구조화 로그" },
  { id: "serviceErrors", path: appRoutePaths.serviceErrors, label: "서비스 오류" },
  { id: "identity", path: appRoutePaths.identity, label: "사용자 추적" },
  { id: "privacy", path: appRoutePaths.privacy, label: "개인정보 조회" },
  { id: "metrics", path: appRoutePaths.metrics, label: "사용자 지표" },
  { id: "security", path: appRoutePaths.security, label: "보안 검증" },
  { id: "executionLog", path: appRoutePaths.executionLog, label: "실행 결과" },
];

export const defaultAppPath = appRoutePaths.collection;

const knownAppPaths = new Set([
  ...appRoutes.map(({ path }) => path),
  ...Object.values(signupFunnelStepPaths),
]);

export function resolveInitialAppPath(pathname: string): string {
  const normalizedPath = pathname === "/" ? pathname : pathname.replace(/\/+$/u, "");
  return knownAppPaths.has(normalizedPath) ? normalizedPath : defaultAppPath;
}
