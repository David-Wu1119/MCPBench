import { StdioTransport } from "./transport.js";
import type { InitializeResult, McpTool } from "./types.js";

const PROTOCOL_VERSION = "2024-11-05";

export class McpClient {
  constructor(public readonly transport: StdioTransport) {}

  async initialize(): Promise<{ result: InitializeResult; latencyMs: number }> {
    const out = await this.transport.request<InitializeResult>("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: "mcpbench", version: "0.1.0" },
      capabilities: {},
    });
    this.transport.notify("notifications/initialized");
    return out;
  }

  async listTools(): Promise<{ tools: McpTool[]; latencyMs: number }> {
    const { result, latencyMs } = await this.transport.request<{ tools: McpTool[] }>("tools/list");
    return { tools: Array.isArray(result?.tools) ? result.tools : [], latencyMs };
  }
}
