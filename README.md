# MCPBench

[![ci](https://github.com/David-Wu1119/MCPBench/actions/workflows/ci.yml/badge.svg)](https://github.com/David-Wu1119/MCPBench/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node 18+](https://img.shields.io/badge/node-18+-339933.svg)](https://nodejs.org/)

> A measurement harness for MCP servers: run probes, score the server, and emit a report card that can fail CI.

MCPBench is a compact example of how I build systems measurement infrastructure:
define measurable failure modes, drive the target through a reproducible harness,
and return numbers plus concrete findings. Here the target is an MCP server; the
same harness shape transfers to serving engines by swapping in latency, quality,
cost, cache, and energy probes.

It spawns an MCP server, speaks JSON-RPC to it, and grades the server across four
categories:

| Signal | What MCPBench measures |
| --- | --- |
| Schema quality | Missing descriptions, broken input schemas, required/property mismatches |
| Latency | `initialize` and `tools/list` p50/p95 across repeated samples |
| Description safety | Prompt-injection patterns, invisible Unicode, code-exec bait, leaked secrets |
| Permission clarity | Destructive-looking tools that fail to warn the agent |

One command:

```bash
npx mcpbench bench -- npx @modelcontextprotocol/server-filesystem ~/Documents
```

Output is designed for humans and CI: 0-100 category scores, an overall letter
grade, concrete findings, JSON output, and an optional README badge.

Short sample:

```
MCPBench Report Card
target: node test/fixtures/bad-server.mjs
server: mock-bad v0.0.1
protocol: 2024-11-05
tools: 3    duration: 66ms

Schema quality          █████████████░░░░░░░   67 / 100
                          tools: 3    score-points: 8/12
Latency                 ████████████████████  100 / 100
                          initialize ms: 58.7   tools/list p95 ms: 0.2   samples: 3
Description safety      ████░░░░░░░░░░░░░░░░   20 / 100
                          high findings: 1    medium findings: 0    tools scanned: 3
Permission clarity      ████████████░░░░░░░░   60 / 100
                          dangerous-looking tools: 2   of those, warned: 0

Overall:  58 / 100   D

Findings
  [HIGH] Schema quality      — missing-description     do_thing: Tool description is missing or too short.
  [HIGH] Schema quality      — missing-input-schema    do_thing: Tool has no JSON-schema for inputs — agents will guess.
  [HIGH] Description safety  — prompt-override         fetch:    description contains a prompt-override pattern.
  [HIGH] Permission clarity  — dangerous-without-warning fetch:  Tool name/description implies a destructive action but does not warn the agent.
  [HIGH] Permission clarity  — dangerous-without-warning exec:   Tool name/description implies a destructive action but does not warn the agent.
```

## Install

```bash
# one-shot, no install
npx mcpbench bench -- npx @modelcontextprotocol/server-filesystem ~/Documents

# global install
npm install -g mcpbench
```

> The `--` separator stops `commander` from trying to parse the server's own flags as `mcpbench` flags.

## What it scores

| Category | Weight | Looks at |
| --- | --- | --- |
| **Schema quality** | 30% | Description length, parameter descriptions, `inputSchema` presence, `required` matches `properties`, sane tool names. |
| **Latency** | 20% | `initialize` latency, `tools/list` p50 / p95 across N samples. <50ms = full score; ≥2000ms = zero. |
| **Description safety** | 30% | Prompt-injection in tool/param descriptions, invisible Unicode, embedded code-exec primitives, OOB-host references, leaked secrets. Cap of 30 if any high-severity injection found. |
| **Permission clarity** | 20% | Destructive-sounding tools (`delete`, `exec`, `kill`, `wipe`, …) must warn. Over-broad filesystem tools penalized. |

Overall score → letter grade: **A+** (95+), **A** (85+), **B** (75+), **C** (65+), **D** (50+), **F** (<50).

## CLI

```bash
mcpbench bench <command> [args...]    # run benchmarks
mcpbench bench --json                 # JSON output
mcpbench bench --out report.json      # write report to file
mcpbench bench --badge                # also print a Shields.io badge for your README
mcpbench bench --samples 10           # latency samples (default: 5)
mcpbench bench --timeout 10000        # per-request timeout in ms (default: 5000)
```

Exit codes:
- `0` if overall score ≥ 65 (B/A/A+)
- `1` if overall score 50–64 (D)
- `2` if overall score < 50 (F)
- `3` if the server failed to start or didn't respond
- `64` for usage errors

## Get a README badge

```bash
mcpbench bench --badge -- node my-mcp-server.js
```

Outputs a markdown line you can paste into your server's README:

```markdown
![mcpbench score](https://img.shields.io/badge/mcpbench-92%20%2F%20100%20A-brightgreen)
```

## CI usage

```yaml
# .github/workflows/mcpbench.yml
name: mcpbench
on: [pull_request]
jobs:
  score:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
      - run: npx mcpbench bench --out mcpbench.json -- node dist/server.js
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: mcpbench, path: mcpbench.json }
```

Use the exit code to gate merges: pass once your server hits at least a B (65+).

## Transports

V0 supports **stdio** transport — what most local MCP servers use. SSE/HTTP transport support is the next milestone.

## Why this exists

Every week another MCP server lands on the registry. Most ship without anyone checking whether their tool descriptions are usable, whether destructive tools warn the agent, whether descriptions accidentally contain prompt-injection bait, or how slow `tools/list` is on cold start. `mcpbench` is a single command that surfaces all of it.

## Roadmap

V0 (this release): stdio transport, four-category scoring, JSON output, Shields.io badge, exit-code-driven CI.

Next:
- HTTP / SSE transport
- Optional `tools/call` round-trip benchmarks (opt-in, with sandboxed args)
- Prompts + Resources scoring
- Public leaderboard for popular open-source MCP servers
- HTML report

## Status

Pre-1.0. Issues and PRs welcome.

## License

MIT.
