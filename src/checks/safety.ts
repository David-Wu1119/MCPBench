import type { McpTool } from "../mcp/types.js";
import type { CategoryResult, Finding } from "./types.js";

const INVISIBLE_RE =
  /[​‌‍‎‏‪‫‬‭‮⁠⁡⁢⁣⁤⁦⁧⁨⁩﻿]/;

const OVERRIDE_RE = [
  /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+instructions?/i,
  /disregard\s+(?:the\s+)?(?:previous|prior|above|system)/i,
  /(?:from\s+now\s+on,?\s+you\s+(?:are|will))\s+/i,
  /system\s+(?:override|prompt\s+override|instruction)\s*:/i,
  /\[\s*(?:assistant\s+instruction|system|admin|developer)\s*\]/i,
  /this\s+(?:rule|instruction|directive)\s+supersedes/i,
  /respond\s+only\s+with\s+(?:the\s+)?(?:literal|exact)?\s*(?:phrase|string|text)?/i,
  /do\s+not\s+(?:include|mention|reveal)\s+(?:this|these|the\s+(?:above|following))\s+instructions?/i,
];

const TOOL_USE_RE = [
  /(?:please\s+)?(?:execute|run|invoke|call)\s+(?:the\s+)?(?:tool|command|shell|function)\s+[`"']/i,
  /\b(?:shell\.exec|os\.system|subprocess\.run|child_process\.exec|eval\()/,
  /curl\s+[^\s]*\s*\|\s*(?:sh|bash|zsh|python|node)/i,
];

const EXFIL_HOSTS_RE = /\b(?:webhook\.site|requestbin|pipedream|burpcollab\.net|interact\.sh|oast\.live|oast\.site|oast\.fun|pingb\.in|attacker\.example)\b/i;

const SECRET_RE = [
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bghp_[A-Za-z0-9]{20,}/,
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

function scanText(text: string, toolName: string, where: "description" | "param-description"): Finding[] {
  const out: Finding[] = [];
  if (INVISIBLE_RE.test(text)) {
    out.push({
      rule: "invisible-unicode",
      severity: "high",
      message: `${where} contains invisible/control characters — agent reads payload that humans cannot see.`,
      target: toolName,
    });
  }
  for (const re of OVERRIDE_RE) {
    if (re.test(text)) {
      out.push({
        rule: "prompt-override",
        severity: "high",
        message: `${where} contains a prompt-override pattern.`,
        target: toolName,
      });
      break;
    }
  }
  for (const re of TOOL_USE_RE) {
    if (re.test(text)) {
      out.push({
        rule: "tool-use-manipulation",
        severity: "high",
        message: `${where} embeds a live code-exec primitive or chained shell installer.`,
        target: toolName,
      });
      break;
    }
  }
  if (EXFIL_HOSTS_RE.test(text)) {
    out.push({
      rule: "exfil-host",
      severity: "high",
      message: `${where} mentions a known OOB / exfil host.`,
      target: toolName,
    });
  }
  for (const re of SECRET_RE) {
    if (re.test(text)) {
      out.push({
        rule: "leaked-secret",
        severity: "high",
        message: `${where} contains a literal credential. Rotate it.`,
        target: toolName,
      });
      break;
    }
  }
  return out;
}

/** Reuses the contextlint rule family on tool descriptions and param docs. */
export function checkSafety(tools: McpTool[]): CategoryResult {
  const findings: Finding[] = [];
  for (const t of tools) {
    if (t.description) findings.push(...scanText(t.description, t.name, "description"));
    const props = t.inputSchema?.properties ?? {};
    for (const [pname, ps] of Object.entries(props)) {
      const d = (ps as any)?.description;
      if (typeof d === "string") {
        findings.push(...scanText(d, `${t.name}.${pname}`, "param-description"));
      }
    }
  }

  const high = findings.filter((f) => f.severity === "high").length;
  const med = findings.filter((f) => f.severity === "medium").length;
  // Description-injection is severe — any high-finding caps the score at 30.
  const score = high > 0 ? Math.max(0, 30 - high * 10) : med > 0 ? Math.max(50, 80 - med * 5) : 100;

  return {
    id: "safety",
    title: "Description safety",
    score,
    findings,
    metrics: {
      "high findings": high,
      "medium findings": med,
      "tools scanned": tools.length,
    },
  };
}
