import { describe, it, expect } from "vitest";
import tauriConf from "../../src-tauri/tauri.conf.json";

/**
 * The webview's Content-Security-Policy lives in `tauri.conf.json`, which
 * nothing else in the frontend reads — so nothing else would notice it going
 * back to `null`. Tauri only injects its script nonces and hashes when a CSP
 * is set, and a `null` policy means any script that reaches the page runs
 * with full IPC.
 */
const conf = tauriConf as { app: { security: { csp: unknown; devCsp?: unknown } } };

/** One directive's value, or the empty string when the policy lacks it. */
function directive(csp: string, name: string): string {
  const found = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name);
  return found?.slice(name.length).trim() ?? "";
}

describe("tauri.conf.json security", () => {
  const csp = conf.app.security.csp;

  it("sets a production CSP", () => {
    expect(typeof csp).toBe("string");
    expect((csp as string).length).toBeGreaterThan(0);
  });

  it("locks the default source down to the app bundle", () => {
    expect(directive(csp as string, "default-src")).toContain("'self'");
  });

  it("never allows eval", () => {
    expect(csp as string).not.toContain("unsafe-eval");
  });

  it("never allows inline scripts in production", () => {
    // Tauri's own injected scripts get a nonce or hash; anything else that
    // lands inline in the page is exactly what the policy is there to stop.
    expect(directive(csp as string, "script-src")).not.toContain("unsafe-inline");
  });

  it("keeps IPC reachable", () => {
    expect(directive(csp as string, "connect-src")).toContain("ipc:");
  });

  it("refuses plugins, base overrides and framing", () => {
    expect(directive(csp as string, "object-src")).toBe("'none'");
    expect(directive(csp as string, "base-uri")).toBe("'none'");
    expect(directive(csp as string, "frame-ancestors")).toBe("'none'");
  });

  it("carries a dev-only policy for the Vite server", () => {
    const devCsp = conf.app.security.devCsp;
    expect(typeof devCsp).toBe("string");
    expect(directive(devCsp as string, "connect-src")).toContain("ws://localhost:1420");
    expect(devCsp as string).not.toContain("unsafe-eval");
  });
});
