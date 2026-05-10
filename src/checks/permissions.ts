import type { McpTool } from "../mcp/types.js";
import type { CategoryResult, Finding } from "./types.js";

const DANGEROUS_HINTS = /\b(?:delete|destroy|remove|drop|truncate|wipe|format|rm|kill|terminate|exec(?:ute)?|spawn|shell|system|eval)\b/i;
const NETWORK_HINTS = /\b(?:fetch|request|http|curl|wget|webhook|post|put|send)\b/i;
const FILESYSTEM_HINTS = /\b(?:file|path|directory|folder|read|write|move|rename|chmod|chown)\b/i;
const WARNING_HINTS = /\b(?:irreversible|destructive|cannot\s+be\s+undone|permanent|requires\s+confirmation|use\s+with\s+caution)\b/i;

function classify(t: McpTool): {
  dangerous: boolean;
  network: boolean;
  fs: boolean;
  warned: boolean;
} {
  const text = `${t.name} ${t.description ?? ""}`;
  return {
    dangerous: DANGEROUS_HINTS.test(text),
    network: NETWORK_HINTS.test(text),
    fs: FILESYSTEM_HINTS.test(text),
    warned: WARNING_HINTS.test(t.description ?? ""),
  };
}

export function checkPermissions(tools: McpTool[]): CategoryResult {
  const findings: Finding[] = [];
  let dangerous = 0;
  let dangerousWithWarning = 0;
  let networkTools = 0;
  let fsTools = 0;

  for (const t of tools) {
    const c = classify(t);
    if (c.dangerous) {
      dangerous++;
      if (c.warned) dangerousWithWarning++;
      else
        findings.push({
          rule: "dangerous-without-warning",
          severity: "high",
          message: `Tool name/description implies a destructive action but does not warn the agent.`,
          target: t.name,
        });
    }
    if (c.network) networkTools++;
    if (c.fs) fsTools++;
  }

  const broadFs = tools.find(
    (t) => /\b(?:read|write|exec)_?(?:file|path|any|all)\b/i.test(`${t.name} ${t.description ?? ""}`),
  );
  if (broadFs) {
    findings.push({
      rule: "overbroad-filesystem",
      severity: "medium",
      message: "A tool name/description implies broad filesystem access — consider scoping by directory.",
      target: broadFs.name,
    });
  }

  // Score: every dangerous tool should be warned. Penalise the unwarned ones.
  const score = (() => {
    if (dangerous === 0 && findings.length === 0) return 100;
    const ratio = dangerous === 0 ? 1 : dangerousWithWarning / dangerous;
    let s = Math.round(60 + ratio * 40);
    s -= findings.filter((f) => f.severity === "medium").length * 10;
    return Math.max(0, Math.min(100, s));
  })();

  return {
    id: "permissions",
    title: "Permission clarity",
    score,
    findings,
    metrics: {
      "dangerous-looking tools": dangerous,
      "of those, warned": dangerousWithWarning,
      "network-touching tools": networkTools,
      "filesystem-touching tools": fsTools,
    },
  };
}
