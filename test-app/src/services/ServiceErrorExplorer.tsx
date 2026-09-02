import { useMemo, useState } from "react";
import {
  buildServiceExplorerUrls,
  frontendServices,
  type FrontendService,
} from "./serviceExplorer.core";

const sentryBaseUrl = import.meta.env.VITE_SENTRY_BASE_URL?.trim() || "http://127.0.0.1:9000";
const sentryOrganization = import.meta.env.VITE_SENTRY_ORG?.trim() || "sentry";
const sentryProjectId = import.meta.env.VITE_SENTRY_PROJECT_ID?.trim() || "2";

export function ServiceErrorExplorer() {
  const [service, setService] = useState<FrontendService>("membership");
  const urls = useMemo(
    () => buildServiceExplorerUrls(sentryBaseUrl, sentryOrganization, sentryProjectId, service),
    [service],
  );

  return (
    <section className="service-explorer" aria-labelledby="service-explorer-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Project boundary × service tag</p>
          <h2 id="service-explorer-title">서비스별 오류 탐색</h2>
        </div>
        <p>공통 프로젝트는 태그로, 운영 프로젝트는 DSN으로 경계를 나눕니다.</p>
      </div>
      <div className="service-explorer__panel">
        <label htmlFor="service-explorer-select">
          <span>서비스 선택</span>
          <select
            id="service-explorer-select"
            value={service}
            onChange={(event) => setService(event.target.value as FrontendService)}
          >
            {frontendServices.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <code>service:{service}</code>
        <nav aria-label={`${service} Sentry 바로가기`}>
          <a href={urls.issues} target="_blank" rel="noreferrer">Issues</a>
          <a href={urls.logs} target="_blank" rel="noreferrer">Logs</a>
          <a href={urls.traces} target="_blank" rel="noreferrer">Traces</a>
        </nav>
      </div>
      <div className="service-projects">
        {frontendServices.map((item) => (
          <article key={item}>
            <strong>{item}</strong>
            <span>frontend-{item}</span>
            <small>독립 DSN · 권한 · 알림</small>
          </article>
        ))}
      </div>
    </section>
  );
}
