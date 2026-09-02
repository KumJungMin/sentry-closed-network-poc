export const pseudonymousIdPattern = /^dbg_v1_[A-Za-z0-9_-]{20,80}$/;

export function isPseudonymousDebugId(value: string): boolean {
  return pseudonymousIdPattern.test(value);
}
