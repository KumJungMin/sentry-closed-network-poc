import { Navigate, Route } from "react-router-dom";
import { NormalizedMetricsSection } from "../analytics/NormalizedMetricsSection";
import { ExecutionLog } from "../components/ExecutionLog";
import { LiveLogsSection } from "../components/LiveLogsSection";
import { TestActionCard } from "../components/TestActionCard";
import { CustomDataTestSection } from "../custom-data/CustomDataTestSection";
import { IdentityTrackingSection } from "../identity/IdentityTrackingSection";
import { PrivacyAccessSection } from "../privacy/PrivacyAccessSection";
import { SecurityTestSection } from "../security/SecurityTestSection";
import { testActions } from "../sentry/actions";
import { sentryRuntime, SentryRoutes } from "../sentry/client";
import { ServiceErrorExplorer } from "../services/ServiceErrorExplorer";
import { SignupFunnelSection } from "../signup-funnel/SignupFunnelSection";
import type { ExecutionEntry, TestActionDefinition, TestActionId } from "../types";
import { appRoutePaths, defaultAppPath, signupFunnelStepPaths } from "./routes.core";

interface AppRouteContentProps {
  entries: ExecutionEntry[];
  pseudonymousId: string;
  runningActionId: TestActionId | null;
  onIdentityChange: (pseudonymousId: string) => void;
  onRun: (action: TestActionDefinition) => Promise<void>;
}

export function AppRouteContent({
  entries,
  pseudonymousId,
  runningActionId,
  onIdentityChange,
  onRun,
}: AppRouteContentProps) {
  return (
    <SentryRoutes>
      <Route path="/" element={<Navigate to={defaultAppPath} replace />} />
      <Route
        path={appRoutePaths.collection}
        element={(
          <section className="test-section" aria-labelledby="test-section-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Seven focused experiments</p>
                <h2 id="test-section-title">수집 기능 테스트</h2>
              </div>
              <p>한 번에 하나씩 실행한 뒤 Sentry 화면과 비교하세요.</p>
            </div>

            <div className="test-grid">
              {testActions.map((action) => (
                <TestActionCard
                  key={action.id}
                  action={action}
                  isDisabled={runningActionId !== null}
                  isRunning={runningActionId === action.id}
                  onRun={onRun}
                />
              ))}
            </div>
          </section>
        )}
      />
      <Route
        path={appRoutePaths.customData}
        element={(
          <CustomDataTestSection
            environment={sentryRuntime.environment}
            release={sentryRuntime.release}
            isSentryEnabled={sentryRuntime.enabled}
          />
        )}
      />
      <Route path={appRoutePaths.signupFunnel} element={<SignupFunnelSection />} />
      <Route
        path={signupFunnelStepPaths.terms}
        element={<SignupFunnelSection currentStep="terms" />}
      />
      <Route
        path={signupFunnelStepPaths.account}
        element={<SignupFunnelSection currentStep="account" />}
      />
      <Route
        path={signupFunnelStepPaths.phone}
        element={<SignupFunnelSection currentStep="phone" />}
      />
      <Route
        path={signupFunnelStepPaths.cdd}
        element={<SignupFunnelSection currentStep="cdd" />}
      />
      <Route
        path={appRoutePaths.logs}
        element={(
          <LiveLogsSection
            isSentryEnabled={sentryRuntime.enabled}
            logsEnabled={sentryRuntime.logsEnabled}
          />
        )}
      />
      <Route path={appRoutePaths.serviceErrors} element={<ServiceErrorExplorer />} />
      <Route
        path={appRoutePaths.identity}
        element={<IdentityTrackingSection onIdentityChange={onIdentityChange} />}
      />
      <Route
        path={appRoutePaths.privacy}
        element={<PrivacyAccessSection key={pseudonymousId || "anonymous"} pseudonymousId={pseudonymousId} />}
      />
      <Route
        path={appRoutePaths.metrics}
        element={<NormalizedMetricsSection pseudonymousId={pseudonymousId} />}
      />
      <Route
        path={appRoutePaths.security}
        element={(
          <SecurityTestSection
            environment={sentryRuntime.environment}
            isSentryEnabled={sentryRuntime.enabled}
            isReplayEnabled={sentryRuntime.replayEnabled}
          />
        )}
      />
      <Route path={appRoutePaths.executionLog} element={<ExecutionLog entries={entries} />} />
      <Route path="*" element={<Navigate to={defaultAppPath} replace />} />
    </SentryRoutes>
  );
}
