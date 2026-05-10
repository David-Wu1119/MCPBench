import { strict as assert } from "node:assert";
import { test } from "node:test";
import { runBench } from "../src/commands/bench.ts";
import { McpClient } from "../src/mcp/client.ts";
import { StdioTransport } from "../src/mcp/transport.ts";
import { checkSchema } from "../src/checks/schema.ts";
import { checkSafety } from "../src/checks/safety.ts";
import { checkPermissions } from "../src/checks/permissions.ts";
import { overall } from "../src/score.ts";

const NODE = process.execPath;

async function fetchTools(fixture: string) {
  const t = new StdioTransport(NODE, [`test/fixtures/${fixture}`]);
  t.start();
  const client = new McpClient(t);
  try {
    await client.initialize();
    const { tools } = await client.listTools();
    return tools;
  } finally {
    t.stop();
  }
}

test("good-server scores high (>=85, grade A or A+)", async () => {
  const tools = await fetchTools("good-server.mjs");
  assert.ok(tools.length >= 2, `expected at least 2 tools, got ${tools.length}`);
  const cats = [
    checkSchema(tools),
    { id: "latency" as const, title: "Latency", score: 100, findings: [] },
    checkSafety(tools),
    checkPermissions(tools),
  ];
  const ov = overall(cats);
  assert.ok(ov.score >= 85, `expected score >=85, got ${ov.score} (grade ${ov.grade})`);
  assert.ok(ov.grade === "A" || ov.grade === "A+", `expected grade A or A+, got ${ov.grade}`);
});

test("bad-server scores low and trips key rules", async () => {
  const tools = await fetchTools("bad-server.mjs");
  const schema = checkSchema(tools);
  const safety = checkSafety(tools);
  const perms = checkPermissions(tools);

  const ruleIds = new Set([
    ...schema.findings.map((f) => f.rule),
    ...safety.findings.map((f) => f.rule),
    ...perms.findings.map((f) => f.rule),
  ]);

  assert.ok(ruleIds.has("missing-description"), "should detect missing description");
  assert.ok(ruleIds.has("missing-input-schema"), "should detect missing input schema");
  assert.ok(ruleIds.has("undescribed-params"), "should detect undescribed params");
  assert.ok(ruleIds.has("prompt-override"), "should detect prompt-injection in description");
  assert.ok(ruleIds.has("dangerous-without-warning"), "should detect unwarned destructive tool");

  const ov = overall([
    schema,
    { id: "latency" as const, title: "Latency", score: 100, findings: [] },
    safety,
    perms,
  ]);
  assert.ok(ov.score < 65, `expected score <65 for bad server, got ${ov.score}`);
});

test("runBench exits 0 on a healthy server", async () => {
  // capture console output to keep the test log readable
  const origLog = console.log;
  console.log = () => {};
  try {
    const code = await runBench([NODE, "test/fixtures/good-server.mjs"], { samples: 2 });
    assert.equal(code, 0, "expected exit 0 on a healthy server");
  } finally {
    console.log = origLog;
  }
});
