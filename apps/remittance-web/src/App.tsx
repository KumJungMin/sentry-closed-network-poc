import { createMockFlowSubmitter, DomainFlowApp, type DomainFlowAppProps } from "@poc/flow-app";
import { captureFlowException, flowEventSink, SentryRoutes } from "./observability.js";

const submitStep = createMockFlowSubmitter({
  targetStep: "authenticate",
  scenarioField: "authCode",
});

const stepContent = {
  recipient: {
    title: "송금받을 사람을 선택해 주세요",
    description: "실제 계좌번호 대신 테스트 수취인 별칭을 사용합니다.",
    field: {
      name: "recipientAlias",
      label: "수취인 별칭",
      type: "text",
      placeholder: "TEST-RECIPIENT",
      required: true,
    },
  },
  amount: {
    title: "송금할 금액을 입력해 주세요",
    description: "0보다 큰 금액만 다음 단계로 진행할 수 있습니다.",
    field: {
      name: "amount",
      label: "송금 금액",
      type: "number",
      placeholder: "10000",
      required: true,
    },
  },
  review: {
    title: "송금 내용을 확인해 주세요",
    description: "수취인과 금액을 확인한 뒤 인증 단계로 이동합니다.",
  },
  authenticate: {
    title: "송금을 인증해 주세요",
    description: "OK은 성공, DECLINE은 업무 거절, TIMEOUT은 기술 오류를 재현합니다.",
    field: {
      name: "authCode",
      label: "테스트 인증 코드",
      type: "password",
      placeholder: "OK / DECLINE / TIMEOUT",
      required: true,
    },
  },
  result: {
    title: "송금 접수가 완료되었습니다",
    description: "서버의 송금 접수 성공을 기준으로 완료 이벤트가 기록됩니다.",
  },
} satisfies DomainFlowAppProps["stepContent"];

export function App() {
  return (
    <DomainFlowApp
      accentColor="#087f5b"
      appTitle="송금 프로세스"
      flowName="remittance"
      onFlowEvent={flowEventSink}
      onFlowException={captureFlowException}
      RoutesComponent={SentryRoutes}
      stepContent={stepContent}
      submitStep={submitStep}
      userId={import.meta.env.VITE_POC_USER_ID ?? "CUSTOMER-REMITTANCE-001"}
    />
  );
}
