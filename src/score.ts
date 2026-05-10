import type { CategoryResult } from "./checks/types.js";

const WEIGHTS: Record<CategoryResult["id"], number> = {
  schema: 0.3,
  latency: 0.2,
  safety: 0.3,
  permissions: 0.2,
};

export interface OverallScore {
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
}

export function overall(categories: CategoryResult[]): OverallScore {
  let total = 0;
  let weight = 0;
  for (const c of categories) {
    const w = WEIGHTS[c.id] ?? 0;
    total += c.score * w;
    weight += w;
  }
  const score = weight === 0 ? 0 : Math.round(total / weight);
  return { score, grade: gradeFor(score) };
}

export function gradeFor(score: number): OverallScore["grade"] {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}
