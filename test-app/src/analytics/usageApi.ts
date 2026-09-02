export type UsageEvent =
  | { actorId: string; kind: "activity"; service: string; page: string }
  | { actorId: string; kind: "error"; service: string; issueKey: string };

export interface NormalizedMetrics {
  generatedAt: string;
  errorRanking: Array<{
    service: string;
    issueKey: string;
    errorEvents: number;
    affectedUsers: number;
    activeUsers: number;
    affectedUserRate: number | null;
  }>;
  funnel: {
    totalAttempts: number;
    completedAttempts: number;
    steps: Array<{
      id: string;
      label: string;
      reached: number;
      dropOff: number;
      dropOffRate: number;
      conversionRate: number;
    }>;
  };
}

export async function recordUsageEvent(event: UsageEvent): Promise<void> {
  const response = await fetch("/internal-api/analytics/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error("사용자 모수 이벤트 저장에 실패했습니다.");
}

export async function fetchNormalizedMetrics(): Promise<NormalizedMetrics> {
  const response = await fetch("/internal-api/analytics/normalized", { cache: "no-store" });
  if (!response.ok) throw new Error("사용자 기준 지표를 불러오지 못했습니다.");
  return response.json() as Promise<NormalizedMetrics>;
}
