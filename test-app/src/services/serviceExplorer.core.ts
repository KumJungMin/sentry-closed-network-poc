export const frontendServices = ["membership", "remittance", "payment"] as const;
export type FrontendService = (typeof frontendServices)[number];

export interface ServiceExplorerUrls {
  issues: string;
  logs: string;
  traces: string;
}

export function buildServiceExplorerUrls(
  baseUrl: string,
  organization: string,
  projectId: string,
  service: FrontendService,
): ServiceExplorerUrls {
  const root = baseUrl.replace(/\/$/, "");
  const query = encodeURIComponent(`service:${service}`);
  const common = `project=${encodeURIComponent(projectId)}&query=${query}`;

  return {
    issues: `${root}/organizations/${organization}/issues/?${common}`,
    logs: `${root}/organizations/${organization}/explore/logs/?${common}`,
    traces: `${root}/organizations/${organization}/explore/traces/?${common}`,
  };
}
