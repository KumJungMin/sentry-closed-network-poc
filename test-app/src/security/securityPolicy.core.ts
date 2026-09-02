import type { Breadcrumb, ErrorEvent } from "@sentry/react";

export interface CollectionPolicy {
  tracesSampleRate: number;
  replayEnabled: boolean;
  replaySessionSampleRate: number;
  replayOnErrorSampleRate: number;
}

const filteredValue = "[Filtered]";
const anonymousUserIdPattern = /^anon[-_][a-z0-9_-]{8,64}$/i;

const sensitiveKeys = new Set([
  "name", "fullname", "firstname", "lastname", "username", "customername",
  "payername", "beneficiaryname", "remittername",
  "phone", "phonenumber", "mobile", "mobilenumber", "tel", "telephone",
  "email", "emailaddress", "account", "accountnumber", "bankaccount",
  "residentregistrationnumber", "residentnumber", "rrn", "ssn",
  "ci", "customerci", "connectioninformation", "otp", "otpcode",
  "authcode", "authenticationcode", "verificationcode", "token",
  "accesstoken", "refreshtoken", "authorization", "cookie", "cookies", "setcookie",
  "sender", "senderinfo", "sendername", "recipient", "recipientinfo", "recipientname",
  "headers", "httpheaders", "requestheaders", "responseheaders", "body",
  "rawrequest", "rawresponse", "requestbody", "responsebody", "apirequest", "apiresponse",
  "form", "formdata", "input", "inputform", "query", "querystring",
  "transactionid", "transactionidentifier", "actualtransactionid", "ipaddress",
]);

const urlKeys = new Set(["url", "uri", "href", "location"]);

export const ignoredErrors: Array<string | RegExp> = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications.",
  /Non-Error promise rejection captured/i,
];

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return sensitiveKeys.has(normalized) || normalized.endsWith("accesstoken") ||
    normalized.endsWith("refreshtoken") || normalized.endsWith("authorization") ||
    normalized.endsWith("cookie") || normalized.endsWith("accountnumber") ||
    normalized.endsWith("transactionid") || normalized.endsWith("email") ||
    normalized.endsWith("phone");
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, filteredValue)
    .replace(/\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/g, filteredValue)
    .replace(/\b\d{6}[ -]?[1-4]\d{6}\b/g, filteredValue)
    .replace(/\b\d{2,6}(?:-\d{2,6}){2,4}\b/g, filteredValue)
    .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${filteredValue}`)
    .replace(/\b(?:otp|auth(?:entication)?_?code|verification_?code)\s*[:=]\s*[^\s,;]+/gi, filteredValue)
    .replace(/\b(?:session|sid|cookie)\s*=\s*[^\s,;]+/gi, filteredValue);
}

function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(sanitizeUnknown);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, childValue]) => {
      if (isSensitiveKey(key)) return [];
      const normalizedKey = normalizeKey(key);
      const sanitizedValue = (urlKeys.has(normalizedKey) || normalizedKey.endsWith("url")) &&
        typeof childValue === "string"
        ? sanitizeUrl(childValue)
        : sanitizeUnknown(childValue);
      return [[key, sanitizedValue]];
    }),
  );
}

function sanitizeUser(user: ErrorEvent["user"]): ErrorEvent["user"] {
  const id = typeof user?.id === "string" ? user.id : "";
  return anonymousUserIdPattern.test(id) ? { id } : undefined;
}

function sanitizeRequest(request: ErrorEvent["request"]): ErrorEvent["request"] {
  if (!request) return undefined;
  return {
    method: request.method,
    url: typeof request.url === "string" ? sanitizeUrl(request.url) : undefined,
  };
}

function parseSampleRate(configuredRate: string | undefined, fallback: number): number {
  const parsedRate = configuredRate?.trim() ? Number(configuredRate) : Number.NaN;
  return Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 1
    ? parsedRate
    : fallback;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

export function buildCollectionPolicy(
  environment: string,
  configuredTraceRate?: string,
  configuredReplayEnabled?: string,
  configuredReplaySessionRate?: string,
  configuredReplayErrorRate?: string,
): CollectionPolicy {
  const environmentName = environment.trim().toLowerCase();
  const isLocal = ["local", "development", "dev"].includes(environmentName);
  const defaultTraceRate = environmentName === "production"
    ? 0.1
    : ["staging", "stage", "sit", "uat"].includes(environmentName) ? 0.5 : 1;
  const replayEnabled = parseBoolean(configuredReplayEnabled) ?? isLocal;
  const defaultReplaySessionRate = isLocal ? 1 : 0;
  const defaultReplayErrorRate = isLocal ? 1 : 0.1;

  return {
    tracesSampleRate: parseSampleRate(configuredTraceRate, defaultTraceRate),
    replayEnabled,
    replaySessionSampleRate: replayEnabled
      ? parseSampleRate(configuredReplaySessionRate, defaultReplaySessionRate)
      : 0,
    replayOnErrorSampleRate: replayEnabled
      ? parseSampleRate(configuredReplayErrorRate, defaultReplayErrorRate)
      : 0,
  };
}

export function sanitizeUrl(value: string): string {
  const indexes = [value.indexOf("?"), value.indexOf("#")].filter((index) => index >= 0);
  return value.slice(0, indexes.length > 0 ? Math.min(...indexes) : value.length);
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  const breadcrumbs = event.breadcrumbs
    ?.map(sanitizeSentryBreadcrumb)
    .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null);

  return {
    ...event,
    message: typeof event.message === "string" ? redactSensitiveText(event.message) : event.message,
    transaction: typeof event.transaction === "string" ? sanitizeUrl(event.transaction) : event.transaction,
    user: sanitizeUser(event.user),
    request: sanitizeRequest(event.request),
    tags: sanitizeUnknown(event.tags) as ErrorEvent["tags"],
    extra: sanitizeUnknown(event.extra) as ErrorEvent["extra"],
    contexts: sanitizeUnknown(event.contexts) as ErrorEvent["contexts"],
    breadcrumbs,
    exception: event.exception ? {
      ...event.exception,
      values: event.exception.values?.map((exception) => ({
        ...exception,
        value: typeof exception.value === "string"
          ? redactSensitiveText(exception.value)
          : exception.value,
      })),
    } : undefined,
  };
}

export function sanitizeSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const category = breadcrumb.category?.toLowerCase() ?? "";
  if (category === "console" || category.startsWith("ui.input") || category.startsWith("ui.change")) {
    return null;
  }

  return {
    ...breadcrumb,
    message: typeof breadcrumb.message === "string"
      ? redactSensitiveText(breadcrumb.message)
      : breadcrumb.message,
    data: sanitizeUnknown(breadcrumb.data) as Breadcrumb["data"],
  };
}
