#!/usr/bin/env node
/**
 * Mock MCP server — well-behaved.
 * Newline-delimited JSON-RPC 2.0 on stdin/stdout.
 * Used by mcpbench's own smoke tests.
 */

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    handle(msg);
  }
});

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function handle(req) {
  if (req.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "mock-good", version: "1.0.0" },
        capabilities: { tools: {} },
      },
    });
    return;
  }
  if (req.method === "notifications/initialized") return; // notification — no reply
  if (req.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        tools: [
          {
            name: "search_docs",
            description: "Search the company documentation corpus and return ranked snippets.",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string", description: "Natural-language query, 1-200 characters." },
                limit: { type: "number", description: "Maximum number of results to return." },
              },
              required: ["query"],
            },
          },
          {
            name: "delete_doc",
            description: "Permanently delete a document by id. Irreversible — requires confirmation from the user.",
            inputSchema: {
              type: "object",
              properties: {
                doc_id: { type: "string", description: "Document identifier returned by search_docs." },
              },
              required: ["doc_id"],
            },
          },
        ],
      },
    });
    return;
  }
  if (typeof req.id === "number") {
    send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "method not found" } });
  }
}
