import type { FlowEventInput, FlowName, FlowStepId } from "@poc/flow-contract";
import type { ComponentType } from "react";
import type { RoutesProps } from "react-router-dom";

export interface FlowStepField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "password" | "checkbox" | "select";
  placeholder?: string;
  options?: readonly { label: string; value: string }[];
  required?: boolean;
}

export interface FlowStepContent {
  title: string;
  description: string;
  field?: FlowStepField;
}

export type FlowEventSink = (event: FlowEventInput) => void | Promise<void>;

export interface DomainFlowAppProps {
  flowName: FlowName;
  appTitle: string;
  accentColor: string;
  userId: string;
  stepContent: Partial<Record<FlowStepId, FlowStepContent>>;
  onFlowEvent?: FlowEventSink;
  RoutesComponent?: ComponentType<RoutesProps>;
}
