import { createMockFlowSubmitter, DomainFlowApp, type DomainFlowAppProps } from "@poc/flow-app";
import { captureFlowException, flowEventSink, SentryRoutes } from "./observability.js";

const submitStep = createMockFlowSubmitter({
  targetStep: "identity",
  scenarioField: "identityCode",
});

const stepContent = {
  terms: {
    title: "서비스 이용 약관에 동의해 주세요",
    description: "가입에 필요한 필수 약관을 확인하고 동의합니다.",
    field: {
      name: "requiredTerms",
      label: "필수 약관 전체 동의",
      type: "checkbox",
      required: true,
    },
  },
  account: {
    title: "로그인에 사용할 계정을 만듭니다",
    description: "PoC용 화면이라 이메일 형식과 필수 입력만 검증합니다.",
    field: {
      name: "email",
      label: "이메일",
      type: "email",
      placeholder: "customer@example.com",
      required: true,
    },
  },
  phone: {
    title: "휴대폰 번호를 확인합니다",
    description: "실제 문자 발송 없이 인증 단계의 이동과 오류를 재현합니다.",
    field: {
      name: "phone",
      label: "휴대폰 번호",
      type: "tel",
      placeholder: "01012345678",
      required: true,
    },
  },
  identity: {
    title: "고객 확인 정보를 입력해 주세요",
    description: "OK은 성공, DECLINE은 정책상 거절, TIMEOUT은 시스템 오류를 재현합니다.",
    field: {
      name: "identityCode",
      label: "테스트 확인 코드",
      type: "text",
      placeholder: "OK / DECLINE / TIMEOUT",
      required: true,
    },
  },
  result: {
    title: "가입이 완료되었습니다",
    description: "회원 생성 성공을 기준으로 절차 완료 이벤트가 기록됩니다.",
  },
} satisfies DomainFlowAppProps["stepContent"];

export function App() {
  return (
    <DomainFlowApp
      accentColor="#2563eb"
      appTitle="가입 절차"
      flowName="membership"
      onFlowEvent={flowEventSink}
      onFlowException={captureFlowException}
      RoutesComponent={SentryRoutes}
      stepContent={stepContent}
      submitStep={submitStep}
      userId={import.meta.env.VITE_POC_USER_ID ?? "CUSTOMER-MEMBERSHIP-001"}
    />
  );
}
