import type { CategoryResult, Finding } from "./types.js";

export interface LatencySample {
  name: string;
  ms: number;
}

function pct(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx];
}

/** Score latency on a soft curve. <50ms = perfect, >=2000ms = 0. */
function scoreFromMs(ms: number): number {
  if (ms <= 50) return 100;
  if (ms >= 2000) return 0;
  return Math.round(100 - ((ms - 50) / (2000 - 50)) * 100);
}

export function summarizeLatency(samples: LatencySample[]): CategoryResult {
  const findings: Finding[] = [];
  const initSample = samples.find((s) => s.name === "initialize");
  const listSamples = samples.filter((s) => s.name === "tools/list");
  const initMs = initSample?.ms ?? 0;
  const listValues = listSamples.map((s) => s.ms);
  const listP50 = pct(listValues, 0.5);
  const listP95 = pct(listValues, 0.95);

  if (!initSample) {
    findings.push({ rule: "no-initialize", severity: "high", message: "initialize never completed." });
  } else if (initMs > 1500) {
    findings.push({ rule: "slow-initialize", severity: "medium", message: `initialize took ${initMs.toFixed(0)}ms (>1500ms).` });
  }
  if (listValues.length > 0 && listP95 > 1000) {
    findings.push({ rule: "slow-tools-list", severity: "medium", message: `tools/list p95 = ${listP95.toFixed(0)}ms (>1000ms).` });
  }

  const initScore = initSample ? scoreFromMs(initMs) : 0;
  const listScore = listValues.length > 0 ? scoreFromMs(listP95) : 50;
  const score = Math.round(initScore * 0.4 + listScore * 0.6);

  return {
    id: "latency",
    title: "Latency",
    score,
    findings,
    metrics: {
      "initialize ms": Number(initMs.toFixed(1)),
      "tools/list p50 ms": Number(listP50.toFixed(1)),
      "tools/list p95 ms": Number(listP95.toFixed(1)),
      "tools/list samples": listValues.length,
    },
  };
}
