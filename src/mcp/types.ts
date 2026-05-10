/** Just the slice of the MCP shape mcpbench actually inspects. */

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: JsonSchema;
  [k: string]: unknown;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
}

export interface ServerInfo {
  name?: string;
  version?: string;
}

export interface InitializeResult {
  protocolVersion?: string;
  serverInfo?: ServerInfo;
  capabilities?: Record<string, unknown>;
}
