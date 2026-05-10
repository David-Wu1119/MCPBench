export type CheckSeverity = "high" | "medium" | "low" | "info";

export interface Finding {
  rule: string;
  severity: CheckSeverity;
  message: string;
  target?: string; // e.g. tool name
}

export type CategoryId = "schema" | "latency" | "safety" | "permissions";

export interface CategoryResult {
  id: CategoryId;
  title: string;
  /** 0-100, higher is better. */
  score: number;
  findings: Finding[];
  metrics?: Record<string, number | string>;
}
