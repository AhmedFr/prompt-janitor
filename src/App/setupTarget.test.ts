import { describe, expect, it } from "vitest";
import { formatSetupTarget, parseSetupTarget } from "./setupTarget";

describe("setup target", () => {
  it("still reads a bare kind, the way the panel and Analytics link today", () => {
    expect(parseSetupTarget("mcp_server")).toEqual({ kind: "mcp_server" });
  });

  it("round-trips every field", () => {
    const t = { kind: "skill", filter: "never", lens: "/code/web app", open: { fileId: "/code/web app/CLAUDE.md" }, tab: "findings" } as const;
    expect(parseSetupTarget(formatSetupTarget(t))).toEqual(t);
  });

  it("round-trips an artifact id", () => {
    expect(parseSetupTarget(formatSetupTarget({ open: { artifactId: 12 } }))).toEqual({ open: { artifactId: 12 } });
  });

  it("drops values it does not know instead of guessing", () => {
    expect(parseSetupTarget("kind=nonsense&filter=loud&tab=raw&open=a:x")).toEqual({});
    expect(parseSetupTarget(undefined)).toEqual({});
    expect(parseSetupTarget("nonsense")).toEqual({});
  });

  it("formats an empty target as nothing", () => {
    expect(formatSetupTarget({})).toBeUndefined();
  });
});
