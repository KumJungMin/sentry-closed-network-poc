import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appRoutePaths, signupFunnelStepPaths } from "../routing/routes.core";
import { publishFunnelDashboardSnapshot } from "../sentry/dashboardTelemetry";
import {
  createAttemptId,
  getNextSignupStep,
  getSignupStepIndex,
  type FunnelSummary,
  type SignupStepId,
} from "./funnel.core";
import { fetchFunnelSummary, recordFunnelEvent } from "./funnelApi";
import { clearFunnelSession, readFunnelSession, writeFunnelSession } from "./funnelSession";

export interface SignupFunnelViewModel {
  currentStep: SignupStepId | null;
  summary: FunnelSummary | null;
  status: string;
  isSubmitting: boolean;
  isPageViewReady: boolean;
  pageViewError: string | null;
  start: () => void;
  advance: () => void;
  abandon: () => void;
  retryPageView: () => void;
}

export function useSignupFunnel(currentStep: SignupStepId | null): SignupFunnelViewModel {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<FunnelSummary | null>(null);
  const [status, setStatus] = useState("집계 서버 연결 확인 중…");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPageViewReady, setIsPageViewReady] = useState(currentStep === null);
  const [pageViewError, setPageViewError] = useState<string | null>(null);
  const [pageViewRetrySequence, setPageViewRetrySequence] = useState(0);
  const recordedPageViewKeyRef = useRef<string | null>(null);
  const summaryRequestSequenceRef = useRef(0);

  const refreshSummary = useCallback(async () => {
    const requestSequence = summaryRequestSequenceRef.current + 1;
    summaryRequestSequenceRef.current = requestSequence;
    try {
      const nextSummary = await fetchFunnelSummary();
      if (summaryRequestSequenceRef.current !== requestSequence) return false;
      setSummary(nextSummary);
      publishFunnelDashboardSnapshot(nextSummary);
      return true;
    } catch {
      if (summaryRequestSequenceRef.current === requestSequence) {
        setStatus("집계 서버 미연결 · pnpm analytics를 실행하세요");
      }
      return false;
    }
  }, []);

  useEffect(() => () => {
    summaryRequestSequenceRef.current += 1;
  }, []);

  useEffect(() => {
    void refreshSummary().then((connected) => {
      if (connected && currentStep === null) setStatus("망 내부 집계 서버 연결됨");
    });
  }, [currentStep, refreshSummary]);

  useEffect(() => {
    if (currentStep === null) {
      setIsPageViewReady(true);
      recordedPageViewKeyRef.current = null;
      return;
    }

    let session = readFunnelSession();
    if (!session) {
      if (currentStep !== "terms") {
        navigate(signupFunnelStepPaths.terms, { replace: true });
        return;
      }
      session = { attemptId: createAttemptId(), furthestStep: currentStep };
      writeFunnelSession(session);
    }

    if (getSignupStepIndex(currentStep) > getSignupStepIndex(session.furthestStep)) {
      navigate(signupFunnelStepPaths[session.furthestStep], { replace: true });
      return;
    }

    const pageViewKey = `${session.attemptId}:${currentStep}:${pageViewRetrySequence}`;
    if (recordedPageViewKeyRef.current === pageViewKey) return;
    recordedPageViewKeyRef.current = pageViewKey;
    setIsPageViewReady(false);
    setPageViewError(null);
    setStatus("현재 화면 pageView 기록 중…");

    void recordFunnelEvent(session.attemptId, currentStep, "page_view")
      .then(async () => {
        if (recordedPageViewKeyRef.current !== pageViewKey) return;
        setIsPageViewReady(true);
        setStatus("현재 화면 pageView 기록됨");
        await refreshSummary();
      })
      .catch((error: unknown) => {
        if (recordedPageViewKeyRef.current !== pageViewKey) return;
        recordedPageViewKeyRef.current = null;
        const message = error instanceof Error ? error.message : "pageView 기록 실패";
        setPageViewError(message);
        setStatus(message);
      });
  }, [currentStep, navigate, pageViewRetrySequence, refreshSummary]);

  const run = (task: () => Promise<void>) => {
    setIsSubmitting(true);
    void task()
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : "퍼널 이벤트 처리 실패");
      })
      .finally(() => setIsSubmitting(false));
  };

  const start = () => {
    const session = { attemptId: createAttemptId(), furthestStep: "terms" as const };
    writeFunnelSession(session);
    navigate(signupFunnelStepPaths.terms);
  };

  const advance = () => {
    if (currentStep === null || !isPageViewReady) return;
    const session = readFunnelSession();
    if (!session) {
      navigate(signupFunnelStepPaths.terms, { replace: true });
      return;
    }

    run(async () => {
      const nextStep = getNextSignupStep(currentStep);
      if (!nextStep) {
        await recordFunnelEvent(session.attemptId, currentStep, "completed");
        clearFunnelSession();
        navigate(appRoutePaths.signupFunnel);
        return;
      }

      await recordFunnelEvent(session.attemptId, currentStep, "advanced");
      writeFunnelSession({ attemptId: session.attemptId, furthestStep: nextStep.id });
      navigate(signupFunnelStepPaths[nextStep.id]);
    });
  };

  const abandon = () => {
    if (currentStep === null || !isPageViewReady) return;
    const session = readFunnelSession();
    if (!session) return;

    run(async () => {
      await recordFunnelEvent(session.attemptId, currentStep, "abandoned");
      clearFunnelSession();
      navigate(appRoutePaths.signupFunnel);
    });
  };

  return {
    currentStep,
    summary,
    status,
    isSubmitting,
    isPageViewReady,
    pageViewError,
    start,
    advance,
    abandon,
    retryPageView: () => setPageViewRetrySequence((current) => current + 1),
  };
}
