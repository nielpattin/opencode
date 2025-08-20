export enum Severity {
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  HINT = 4,
}

export const SeverityMap: Record<string, Severity> = {
  ERROR: Severity.ERROR,
  WARN: Severity.WARN,
  INFO: Severity.INFO,
  HINT: Severity.HINT,
}
