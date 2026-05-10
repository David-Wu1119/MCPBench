import type { McpTool } from "../mcp/types.js";
import type { CategoryResult, Finding } from "./types.js";

/** How well-described the server's tools are. */
export function checkSchema(tools: McpTool[]): CategoryResult {
  const findings: Finding[] = [];
  if (tools.length === 0) {
    return {
      id: "schema",
      title: "Schema quality",
      score: 0,
      findings: [
        {
          rule: "no-tools",
          severity: "high",
          message: "Server exposed no tools.",
        },
      ],
    };
  }

  let perToolMax = 0;
  let perToolEarned = 0;

  for (const t of tools) {
    // 4 points per tool: name (1), description (1), inputSchema present (1), every param described (1)
    perToolMax += 4;

    if (t.name && /^[a-zA-Z][\w./-]{0,79}$/.test(t.name)) perToolEarned += 1;
    else findings.push({ rule: "bad-tool-name", severity: "medium", message: `Tool name '${t.name ?? "?"}' is missing or non-standard.`, target: t.name });

    const desc = (t.description ?? "").trim();
    if (desc.length >= 20) perToolEarned += 1;
    else findings.push({ rule: "missing-description", severity: "high", message: `Tool description is missing or too short (<20 chars).`, target: t.name });

    const schema = t.inputSchema;
    if (schema && typeof schema === "object" && schema.type === "object") {
      perToolEarned += 1;
      const props = schema.properties ?? {};
      const paramNames = Object.keys(props);
      if (paramNames.length === 0) {
        // tools with no params still get the param-description point
        perToolEarned += 1;
      } else {
        const undescribed = paramNames.filter((p) => {
          const ps = props[p];
          return !ps || typeof ps.description !== "string" || ps.description.trim().length < 5;
        });
        if (undescribed.length === 0) perToolEarned += 1;
        else
          findings.push({
            rule: "undescribed-params",
            severity: "medium",
            message: `${undescribed.length}/${paramNames.length} parameter(s) have no description: ${undescribed.join(", ")}.`,
            target: t.name,
          });

        // also check: required params declared
        const required = Array.isArray(schema.required) ? schema.required : [];
        const knownProps = new Set(paramNames);
        const ghostRequired = required.filter((r) => !knownProps.has(r));
        if (ghostRequired.length > 0) {
          findings.push({
            rule: "ghost-required",
            severity: "medium",
            message: `'required' lists parameters not in 'properties': ${ghostRequired.join(", ")}.`,
            target: t.name,
          });
        }
      }
    } else {
      findings.push({
        rule: "missing-input-schema",
        severity: "high",
        message: "Tool has no JSON-schema for inputs — agents will guess.",
        target: t.name,
      });
    }
  }

  const score = perToolMax === 0 ? 0 : Math.round((perToolEarned / perToolMax) * 100);
  return {
    id: "schema",
    title: "Schema quality",
    score,
    findings,
    metrics: {
      "tools": tools.length,
      "score-points": `${perToolEarned}/${perToolMax}`,
    },
  };
}
