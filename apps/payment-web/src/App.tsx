import { DomainFlowApp, type DomainFlowAppProps } from "@poc/flow-app";
import { flowEventSink, SentryRoutes } from "./observability.js";

const stepContent = {
  order: {
    title: "결제할 주문을 확인해 주세요",
    description: "테스트 주문의 상품과 금액을 확인한 뒤 결제를 시작합니다.",
  },
  method: {
    title: "결제 수단을 선택해 주세요",
    description: "실제 카드번호는 입력하지 않고 테스트 결제수단 코드만 저장합니다.",
    field: {
      name: "paymentMethod",
      label: "결제 수단",
      type: "select",
      required: true,
      options: [
        { label: "테스트 카드", value: "test-card" },
        { label: "테스트 간편결제", value: "test-wallet" },
      ],
    },
  },
  review: {
    title: "최종 결제 내용을 확인해 주세요",
    description: "주문 금액과 결제수단을 확인한 뒤 인증 단계로 이동합니다.",
  },
  authenticate: {
    title: "결제를 인증해 주세요",
    description: "Mock API에서 승인, 거절, 통신 오류를 재현하기 위한 테스트 코드입니다.",
    field: {
      name: "authCode",
      label: "테스트 인증 코드",
      type: "password",
      placeholder: "123456",
      required: true,
    },
  },
  result: {
    title: "결제가 완료되었습니다",
    description: "서버의 결제 승인 성공을 기준으로 완료 이벤트가 기록됩니다.",
  },
} satisfies DomainFlowAppProps["stepContent"];

export function App() {
  return (
    <DomainFlowApp
      accentColor="#7c3aed"
      appTitle="결제 프로세스"
      flowName="payment"
      onFlowEvent={flowEventSink}
      RoutesComponent={SentryRoutes}
      stepContent={stepContent}
      userId={import.meta.env.VITE_POC_USER_ID ?? "CUSTOMER-PAYMENT-001"}
    />
  );
}
