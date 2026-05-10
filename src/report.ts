import pc from "picocolors";
import type { CategoryResult, Finding } from "./checks/types.js";
import type { InitializeResult, McpTool } from "./mcp/types.js";
import { overall, type OverallScore } from "./score.js";

function colorScore(score: number): string {
  if (score >= 85) return pc.green(`${score}`);
  if (score >= 65) return pc.cyan(`${score}`);
  if (score >= 50) return pc.yellow(`${score}`);
  return pc.red(`${score}`);
}

function colorGrade(grade: OverallScore["grade"]): string {
  if (grade.startsWith("A")) return pc.bold(pc.green(grade));
  if (grade === "B") return pc.bold(pc.cyan(grade));
  if (grade === "C") return pc.bold(pc.yellow(grade));
  if (grade === "D") return pc.bold(pc.yellow(grade));
  return pc.bold(pc.red(grade));
}

const SEV_COLOR = {
  high: (s: string) => pc.bold(pc.red(s)),
  medium: (s: string) => pc.yellow(s),
  low: (s: string) => pc.cyan(s),
  info: (s: string) => pc.gray(s),
} as const;

function bar(score: number, width = 20): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const block = "█".repeat(filled) + "░".repeat(empty);
  if (score >= 85) return pc.green(block);
  if (score >= 65) return pc.cyan(block);
  if (score >= 50) return pc.yellow(block);
  return pc.red(block);
}

export interface BenchReport {
  target: string;
  serverInfo?: InitializeResult["serverInfo"];
  protocolVersion?: string;
  tools: McpTool[];
  categories: CategoryResult[];
  overall: OverallScore;
  startedAt: string;
  durationMs: number;
}

export function buildReport(
  target: string,
  init: InitializeResult | undefined,
  tools: McpTool[],
  categories: CategoryResult[],
  startedAt: string,
  durationMs: number,
): BenchReport {
  return {
    target,
    serverInfo: init?.serverInfo,
    protocolVersion: init?.protocolVersion,
    tools,
    categories,
    overall: overall(categories),
    startedAt,
    durationMs,
  };
}

export function printReport(r: BenchReport): void {
  console.log(pc.bold(pc.white(`\nMCPBench Report Card`)));
  console.log(pc.gray(`target: ${r.target}`));
  if (r.serverInfo?.name) {
    console.log(pc.gray(`server: ${r.serverInfo.name}${r.serverInfo.version ? ` v${r.serverInfo.version}` : ""}`));
  }
  if (r.protocolVersion) console.log(pc.gray(`protocol: ${r.protocolVersion}`));
  console.log(pc.gray(`tools: ${r.tools.length}    duration: ${r.durationMs.toFixed(0)}ms\n`));

  for (const c of r.categories) {
    const head = `${c.title.padEnd(22)}  ${bar(c.score)}  ${colorScore(c.score).padStart(3)} / 100`;
    console.log(head);
    if (c.metrics) {
      const parts = Object.entries(c.metrics).map(([k, v]) => `${k}: ${v}`);
      console.log(pc.gray(`                          ${parts.join("    ")}`));
    }
  }

  console.log("");
  console.log(pc.bold(`Overall:  ${colorScore(r.overall.score)} / 100   ${colorGrade(r.overall.grade)}`));

  const allFindings: Array<Finding & { category: string }> = [];
  for (const c of r.categories) for (const f of c.findings) allFindings.push({ ...f, category: c.title });

  if (allFindings.length > 0) {
    console.log(pc.bold("\nFindings"));
    allFindings.sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
    for (const f of allFindings) {
      const tag = SEV_COLOR[f.severity](`[${labelFor(f.severity)}]`);
      const target = f.target ? pc.cyan(` ${f.target}`) : "";
      console.log(`  ${tag} ${pc.gray(f.category)} — ${f.rule}${target}: ${f.message}`);
    }
  } else {
    console.log(pc.green("\n✓ No findings."));
  }
}

function sevRank(s: Finding["severity"]): number {
  return { high: 0, medium: 1, low: 2, info: 3 }[s];
}
function labelFor(s: Finding["severity"]): string {
  return { high: "HIGH", medium: "MED ", low: "LOW ", info: "INFO" }[s];
}

export function badgeMarkdown(r: BenchReport): string {
  const grade = r.overall.grade.replace("+", "%2B");
  const color =
    r.overall.score >= 85
      ? "brightgreen"
      : r.overall.score >= 65
        ? "blue"
        : r.overall.score >= 50
          ? "yellow"
          : "red";
  return `![mcpbench score](https://img.shields.io/badge/mcpbench-${r.overall.score}%20%2F%20100%20${grade}-${color})`;
}
