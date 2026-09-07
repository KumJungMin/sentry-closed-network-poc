import { getFlowDefinition, type FlowStep } from "@poc/flow-contract";
import type { CSSProperties } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { DomainFlowAppProps, FlowStepContent, FlowStepField } from "./types.js";
import { useFlowStepPage } from "./useFlowStepPage.js";

interface StepFormProps {
  field?: FlowStepField;
  value: string | boolean;
  errorMessage?: string;
  onChange: (value: string | boolean) => void;
}

function StepForm(_props: StepFormProps) {
  const { errorMessage, field, onChange, value } = _props;
  if (!field) return null;
  const errorId = `${field.name}-error`;

  return (
    <div className="field">
      {field.type === "checkbox" ? (
        <label className="checkbox-row">
          <input
            aria-describedby={errorMessage ? errorId : undefined}
            checked={value === true}
            name={field.name}
            onChange={(event) => onChange(event.target.checked)}
            type="checkbox"
          />
          <span>{field.label}</span>
        </label>
      ) : (
        <label>
          <span className="field-label">{field.label}</span>
          {field.type === "select" ? (
            <select
              aria-describedby={errorMessage ? errorId : undefined}
              name={field.name}
              onChange={(event) => onChange(event.target.value)}
              value={String(value)}
            >
              <option value="">선택해 주세요</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : (
            <input
              aria-describedby={errorMessage ? errorId : undefined}
              name={field.name}
              onChange={(event) => onChange(event.target.value)}
              placeholder={field.placeholder}
              type={field.type}
              value={String(value)}
            />
          )}
        </label>
      )}
      {errorMessage ? <p className="field-error" id={errorId} role="alert">{errorMessage}</p> : null}
    </div>
  );
}

interface FlowStepPageProps extends DomainFlowAppProps {
  step: FlowStep;
  content: FlowStepContent;
}

function FlowStepPage(_props: FlowStepPageProps) {
  const { appTitle, content, flowName, onFlowEvent, step, userId } = _props;
  const vm = useFlowStepPage({ flowName, stepId: step.id, content, onFlowEvent, userId });

  return (
    <main className="flow-page">
      <header className="flow-header">
        <span className="app-mark" aria-hidden="true">F</span>
        <div>
          <p className="eyebrow">내부 설치형 Sentry 활용 PoC</p>
          <h1>{appTitle}</h1>
        </div>
      </header>

      <section className="flow-card" aria-labelledby="step-title">
        <div className="progress-row">
          <span>단계 {vm.currentIndex + 1} / {vm.stepCount}</span>
          <span>{Math.round(((vm.currentIndex + 1) / vm.stepCount) * 100)}%</span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${((vm.currentIndex + 1) / vm.stepCount) * 100}%` }} />
        </div>

        <p className="step-label">{step.label}</p>
        <h2 id="step-title">{content.title}</h2>
        <p className="step-description">{content.description}</p>

        {vm.isLastStep ? (
          <div className="result-panel">
            <strong>플로우가 정상적으로 완료되었습니다.</strong>
            <p>새 시도를 시작하면 별도의 attempt ID로 기록됩니다.</p>
            <button className="primary-button" onClick={vm.handleRestart} type="button">새로 시작</button>
          </div>
        ) : (
          <form onSubmit={vm.handleSubmit}>
            <StepForm
              errorMessage={vm.errorMessage}
              field={content.field}
              onChange={vm.handleFieldChange}
              value={vm.fieldValue}
            />
            <div className="button-row">
              {!vm.isFirstStep ? <button onClick={vm.handleBack} type="button">이전</button> : <span />}
              <button className="primary-button" type="submit">다음</button>
            </div>
            <button className="cancel-button" onClick={vm.handleCancel} type="button">이 플로우 취소</button>
          </form>
        )}
      </section>

      <footer className="flow-footer">
        <span>user.id: {userId}</span>
        <span>attempt: {vm.attemptId}</span>
      </footer>
    </main>
  );
}

export function DomainFlowApp(_props: DomainFlowAppProps) {
  const definition = getFlowDefinition(_props.flowName);
  const style = { "--accent-color": _props.accentColor } as CSSProperties;
  const RoutesComponent = _props.RoutesComponent ?? Routes;

  return (
    <div className="domain-app" style={style}>
      <RoutesComponent>
        {definition.steps.map((step) => {
          const content = _props.stepContent[step.id];
          if (!content) throw new Error(`${_props.flowName}.${step.id} 화면 내용이 없습니다.`);
          return (
            <Route
              element={<FlowStepPage {..._props} content={content} step={step} />}
              key={step.path}
              path={step.path}
            />
          );
        })}
        <Route path="*" element={<Navigate replace to={definition.steps[0].path} />} />
      </RoutesComponent>
    </div>
  );
}
