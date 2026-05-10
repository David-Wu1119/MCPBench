import { writeFileSync } from "node:fs";
import pc from "picocolors";
import { McpClient } from "../mcp/client.js";
import { StdioTransport } from "../mcp/transport.js";
import { checkSchema } from "../checks/schema.js";
import { checkSafety } from "../checks/safety.js";
import { checkPermissions } from "../checks/permissions.js";
import { summarizeLatency, type LatencySample } from "../checks/latency.js";
import { buildReport, printReport, badgeMarkdown } from "../report.js";

export interface BenchOptions {
  json?: boolean;
  out?: string;
  badge?: boolean;
  samples?: number;
  timeout?: number;
}

export async function runBench(commandAndArgs: string[], opts: BenchOptions): Promise<number> {
  if (commandAndArgs.length === 0) {
    console.error(pc.red("error: no command provided. Usage: mcpbench bench <command> [args...]"));
    return 64;
  }
  const [command, ...args] = commandAndArgs;
  const samples = Math.max(1, Math.min(50, opts.samples ?? 5));
  const timeout = opts.timeout ?? 5000;
  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const transport = new StdioTransport(command, args);
  transport.start();
  const client = new McpClient(transport);

  const latencySamples: LatencySample[] = [];
  let init;
  let tools;

  try {
    const initOut = await client.initialize();
    init = initOut.result;
    latencySamples.push({ name: "initialize", ms: initOut.latencyMs });

    for (let i = 0; i < samples; i++) {
      const out = await client.listTools();
      latencySamples.push({ name: "tools/list", ms: out.latencyMs });
      if (i === 0) tools = out.tools;
    }
  } catch (err) {
    transport.stop();
    console.error(pc.red(`error: ${err instanceof Error ? err.message : String(err)}`));
    const stderr = transport.getStderr().trim();
    if (stderr) console.error(pc.gray(stderr.split("\n").slice(-5).join("\n")));
    return 3;
  } finally {
    transport.stop();
  }

  const toolsArr = tools ?? [];
  const categories = [
    checkSchema(toolsArr),
    summarizeLatency(latencySamples),
    checkSafety(toolsArr),
    checkPermissions(toolsArr),
  ];
  const target = [command, ...args].join(" ");
  const report = buildReport(target, init, toolsArr, categories, startedAt, performance.now() - t0);

  if (opts.json) {
    const payload = JSON.stringify(report, null, 2);
    if (opts.out) writeFileSync(opts.out, payload);
    else console.log(payload);
  } else {
    printReport(report);
    if (opts.badge) {
      console.log("\n" + pc.gray("README badge:"));
      console.log(badgeMarkdown(report));
    }
    if (opts.out) {
      writeFileSync(opts.out, JSON.stringify(report, null, 2));
      console.log(pc.gray(`\nReport written to ${opts.out}`));
    }
  }

  return report.overall.score >= 65 ? 0 : report.overall.score >= 50 ? 1 : 2;
}
