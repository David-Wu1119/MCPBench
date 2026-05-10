#!/usr/bin/env node
import { Command } from "commander";
import { runBench } from "./commands/bench.js";

const program = new Command();

program
  .name("mcpbench")
  .description("Benchmark + score MCP servers across schema quality, latency, description safety, and permission clarity.")
  .version("0.1.0");

program
  .command("bench", { isDefault: true })
  .description("Spawn an MCP server and run the benchmark suite against it.")
  .argument("<command...>", "command + args to launch the MCP server (use -- to separate from mcpbench flags)")
  .option("--json", "emit a JSON report instead of pretty terminal output")
  .option("-o, --out <file>", "write report to a file")
  .option("--badge", "also print a Shields.io badge markdown for your README")
  .option("--samples <n>", "tools/list samples to draw for latency stats (default: 5)", (v) => parseInt(v, 10))
  .option("--timeout <ms>", "per-request timeout in ms (default: 5000)", (v) => parseInt(v, 10))
  .action(async (commandAndArgs: string[], opts) => {
    const code = await runBench(commandAndArgs, opts);
    process.exit(code);
  });

program.parseAsync(process.argv);
