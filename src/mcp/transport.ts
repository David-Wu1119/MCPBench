import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

/**
 * Newline-delimited JSON-RPC 2.0 over a child process's stdio.
 * Minimal — just enough to bench MCP servers without pulling the SDK.
 */
export class StdioTransport {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buf = "";
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; sentAt: number }>();
  private stderr = "";
  private listeners: Array<(msg: any) => void> = [];
  private closed = false;

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private readonly opts: { env?: NodeJS.ProcessEnv; cwd?: string } = {},
  ) {}

  start(): void {
    this.child = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.opts.env },
      cwd: this.opts.cwd,
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.child.stderr.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
    this.child.on("exit", () => {
      this.closed = true;
      const err = new Error("transport closed");
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    });
    this.child.on("error", (err) => {
      this.closed = true;
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    });
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    let nl: number;
    while ((nl = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof msg.id === "number" && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
        else p.resolve({ result: msg.result, latencyMs: performance.now() - p.sentAt });
      } else {
        for (const cb of this.listeners) cb(msg);
      }
    }
  }

  onNotification(cb: (msg: any) => void): void {
    this.listeners.push(cb);
  }

  request<T = any>(method: string, params?: unknown, timeoutMs = 5000): Promise<{ result: T; latencyMs: number }> {
    if (!this.child || this.closed) return Promise.reject(new Error("transport not running"));
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout after ${timeoutMs}ms waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
        sentAt: performance.now(),
      });
      try {
        this.child!.stdin.write(JSON.stringify(payload) + "\n");
      } catch (e) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  notify(method: string, params?: unknown): void {
    if (!this.child || this.closed) return;
    const payload = { jsonrpc: "2.0", method, params };
    try {
      this.child.stdin.write(JSON.stringify(payload) + "\n");
    } catch {
      /* ignore */
    }
  }

  /** Send something deliberately malformed to see how the server reacts. */
  sendRaw(line: string): void {
    if (!this.child || this.closed) return;
    try {
      this.child.stdin.write(line.endsWith("\n") ? line : line + "\n");
    } catch {
      /* ignore */
    }
  }

  stop(): void {
    if (this.child && !this.closed) {
      try {
        this.child.stdin.end();
      } catch {
        /* ignore */
      }
      this.child.kill("SIGTERM");
      this.closed = true;
    }
  }

  getStderr(): string {
    return this.stderr;
  }
}
