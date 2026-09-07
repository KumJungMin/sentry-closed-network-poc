import {
  apiStatusOptions,
  authenticationMethodOptions,
  businessStateOptions,
  channelOptions,
  currencyOptions,
  processStepOptions,
  serviceOptions,
  type CustomDataFormState,
} from "./customData.core";
import { useCustomDataTest } from "./useCustomDataTest";

interface CustomDataTestSectionProps {
  environment: string;
  release: string;
  isSentryEnabled: boolean;
}

interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}

function SelectField({ label, name, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="custom-data-field" htmlFor={name}>
      <span>{label}</span>
      <select id={name} name={name} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function CustomDataTestSection({
  environment,
  release,
  isSentryEnabled,
}: CustomDataTestSectionProps) {
  const { form, errors, isSubmitting, result, updateField, submit } =
    useCustomDataTest(isSentryEnabled);

  const updateStringField = <Key extends keyof CustomDataFormState>(field: Key, value: string) => {
    updateField(field, value as CustomDataFormState[Key]);
  };

  return (
    <section className="custom-data-section" aria-labelledby="custom-data-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Phase 5 · Financial WebView</p>
          <h2 id="custom-data-title">업무 데이터 직접 수집</h2>
        </div>
        <p>검색용 Tag와 상세 분석용 Context, 시간순 Breadcrumb를 한 이벤트에서 비교합니다.</p>
      </div>

      <div className="custom-data-layout">
        <form
          className="custom-data-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="custom-data-runtime" aria-label="Sentry 내장 필드">
            <span>내장 Environment <strong>{environment}</strong></span>
            <span>내장 Release <strong>{release}</strong></span>
          </div>

          <div className="custom-data-fields">
            <SelectField label="채널" name="channel" value={form.channel} options={channelOptions} onChange={(value) => updateStringField("channel", value)} />
            <SelectField label="서비스" name="service" value={form.service} options={serviceOptions} onChange={(value) => updateStringField("service", value)} />
            <label className="custom-data-field" htmlFor="partner">
              <span>제휴사</span>
              <input id="partner" name="partner" value={form.partner} readOnly />
            </label>
            <SelectField label="통화" name="currency" value={form.currency} options={currencyOptions} onChange={(value) => updateStringField("currency", value)} />
            <label className="custom-data-field" htmlFor="error-code">
              <span>오류 코드</span>
              <input id="error-code" name="error-code" value={form.errorCode} onChange={(event) => updateField("errorCode", event.target.value)} />
            </label>
            <label className="custom-data-field" htmlFor="page">
              <span>화면</span>
              <input id="page" name="page" value={form.page} onChange={(event) => updateField("page", event.target.value)} />
            </label>
            <SelectField label="처리 단계" name="process-step" value={form.processStep} options={processStepOptions} onChange={(value) => updateStringField("processStep", value)} />
            <SelectField label="인증 방식" name="authentication-method" value={form.authenticationMethod} options={authenticationMethodOptions} onChange={(value) => updateStringField("authenticationMethod", value)} />
            <label className="custom-data-field" htmlFor="retry-count">
              <span>재시도 횟수</span>
              <input id="retry-count" name="retry-count" type="number" min="0" max="5" value={form.retryCount} onChange={(event) => updateField("retryCount", event.target.valueAsNumber)} />
            </label>
            <SelectField label="API 상태" name="api-status" value={form.apiStatus} options={apiStatusOptions} onChange={(value) => updateStringField("apiStatus", value)} />
            <SelectField label="업무 상태" name="business-state" value={form.businessState} options={businessStateOptions} onChange={(value) => updateStringField("businessState", value)} />
          </div>

          {errors.length > 0 && (
            <div className="custom-data-feedback custom-data-feedback--failed" role="alert">
              <strong>입력값을 확인하세요.</strong>
              <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          )}

          {result && (
            <div className={`custom-data-feedback custom-data-feedback--${result.tone}`} role="status">
              <strong>{result.summary}</strong>
              <span>{result.detail}</span>
            </div>
          )}

          <button className="custom-data-submit" type="submit" disabled={!isSentryEnabled || isSubmitting}>
            {!isSentryEnabled ? "SDK 연결 필요" : isSubmitting ? "전송 확인 중…" : "업무 오류 전송"}
          </button>
        </form>

        <aside className="custom-data-guide" aria-label="사용자 지정 데이터 분류 기준">
          <h3>어디에 저장하나?</h3>
          <dl>
            <div>
              <dt>Tag</dt>
              <dd>channel, service, partner, currency, error_code, page, process_step</dd>
            </div>
            <div>
              <dt>Context</dt>
              <dd>인증 방식, 재시도 횟수, 정제된 API 상태, 개인정보 없는 업무 상태</dd>
            </div>
            <div>
              <dt>Breadcrumb</dt>
              <dd>화면 진입부터 검증 실패와 오류 발생까지 6단계 흐름</dd>
            </div>
          </dl>
          <p>금액, 수취인 원문, 계좌번호, 토큰, API 원문은 이 실험에서 수집하지 않습니다.</p>
        </aside>
      </div>
    </section>
  );
}
