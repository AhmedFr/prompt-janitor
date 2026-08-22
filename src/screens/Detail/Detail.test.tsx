import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { ArtifactView, FileDetail, SetupView } from "@/lib/ipc";
import { Detail } from "./Detail";

const openExternal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/open-external", () => ({ openExternal }));

const getFileDetail = vi.hoisted(() => vi.fn());
const getAiConfig = vi.hoisted(() => vi.fn());
const getEntitlement = vi.hoisted(() => vi.fn());
const hasBackup = vi.hoisted(() => vi.fn());
const applyFix = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());
const getSetup = vi.hoisted(() => vi.fn());
const getEffectiveRules = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: {
      getFileDetail,
      getAiConfig,
      getEntitlement,
      hasBackup,
      applyFix,
      scanNow,
      getSetup,
      getEffectiveRules,
    },
  };
});

const detail: FileDetail = {
  id: "f1",
  name: "CLAUDE.md",
  project: "demo",
  path: "/demo/CLAUDE.md",
  grade: "C",
  score: 71,
  content: "line one\nline two",
  delta: null,
  issues: [
    {
      line: 1,
      severity: "hi",
      source: "anthropic",
      title: "Deprecated model reference",
      why: "The model name is out of date.",
      fix_from: "gpt-3",
      fix_to: "current model",
    },
  ],
  dimensions: [
    { dimension: "Consistency", score: 62 },
    { dimension: "Format", score: 30 },
    { dimension: "Clarity", score: 71 },
    { dimension: "Structure", score: 55 },
    { dimension: "Examples", score: 20 },
  ],
};

const skill: ArtifactView = {
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "skill",
  name: "adapt",
  path: "/home/u/.claude/skills/adapt/SKILL.md",
  plugin_name: null,
  description: null,
  bytes: 120,
  grade: "A",
  score: 91,
  file_id: null,
  usage: null,
};

const setupView: SetupView = {
  harnesses: [],
  global: [skill],
  projects: [
    {
      harness: "claude_code",
      path: "/demo",
      name: "demo",
      exists: true,
      session_count: 4,
      last_session_at: null,
      artifacts: [],
    },
  ],
};

function setup(entitled: boolean) {
  getFileDetail.mockResolvedValue({ status: "ok", data: detail });
  getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "none", model: "", has_key: false } });
  getEntitlement.mockResolvedValue({ status: "ok", data: { paid: entitled, email: null, plan: null } });
  hasBackup.mockResolvedValue({ status: "ok", data: false });
  scanNow.mockResolvedValue({ status: "ok", data: {} });
  getSetup.mockResolvedValue({ status: "ok", data: setupView });
  getEffectiveRules.mockResolvedValue({
    status: "ok",
    data: [
      { layer: "global", path: "/home/u/.claude/CLAUDE.md", name: "global CLAUDE.md", grade: "B", file_id: "f0" },
      { layer: "project", path: "/demo/CLAUDE.md", name: "demo CLAUDE.md", grade: "C", file_id: "f1" },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("Detail file scorecard", () => {
  it("renders the dimension radar scorecard with the weakest-two dimensions", async () => {
    setup(true);
    render(<Detail fileId="f1" navigate={() => {}} />);

    expect(await screen.findByText("File scorecard")).toBeInTheDocument();
    expect(screen.getByText("C · 71")).toBeInTheDocument();
    expect(screen.getByText("Weakest on Examples & Format")).toBeInTheDocument();
  });
});

describe("Detail toolbar Auto-fix", () => {
  it("opens the checkout instead of calling apply_fix when the user isn't entitled", async () => {
    setup(false);
    render(<Detail fileId="f1" navigate={() => {}} />);

    const button = await screen.findByRole("button", { name: /Auto-fix 1/ });
    fireEvent.click(button);

    await waitFor(() => expect(openExternal).toHaveBeenCalledWith(expect.stringContaining("polar")));
    expect(applyFix).not.toHaveBeenCalled();
    expect(screen.getByText(/Auto-fix across a whole file is a paid feature/)).toBeInTheDocument();
  });

  it("applies fixes and rescans when entitled", async () => {
    setup(true);
    applyFix.mockResolvedValue({ status: "ok", data: { git_ref: null } });
    render(<Detail fileId="f1" navigate={() => {}} />);

    const button = await screen.findByRole("button", { name: /Auto-fix 1/ });
    fireEvent.click(button);

    await waitFor(() =>
      expect(applyFix).toHaveBeenCalledWith("f1", [{ from: "gpt-3", to: "current model" }], false, "auto"),
    );
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("surfaces the apply_fix error instead of silently no-oping", async () => {
    setup(true);
    applyFix.mockResolvedValue({ status: "error", error: "PAID_GATE: auto-fix requires a license" });
    render(<Detail fileId="f1" navigate={() => {}} />);

    const button = await screen.findByRole("button", { name: /Auto-fix 1/ });
    fireEvent.click(button);

    expect(await screen.findByText(/PAID_GATE: auto-fix requires a license/)).toBeInTheDocument();
  });
});

describe("Detail per-issue Apply fix", () => {
  it("calls apply_fix with origin 'manual', not 'auto'", async () => {
    setup(true);
    applyFix.mockResolvedValue({ status: "ok", data: { git_ref: null } });
    render(<Detail fileId="f1" navigate={() => {}} />);

    const button = await screen.findByRole("button", { name: /Apply fix/ });
    fireEvent.click(button);

    await waitFor(() =>
      expect(applyFix).toHaveBeenCalledWith("f1", [{ from: "gpt-3", to: "current model" }], false, "manual"),
    );
  });
});

describe("Detail merge position", () => {
  it("places the file in its project's stack, keyed off the project's own harness", async () => {
    setup(true);
    render(<Detail fileId="f1" navigate={() => {}} />);

    expect(await screen.findByText("Project rules — loaded after global")).toBeInTheDocument();
    expect(getEffectiveRules).toHaveBeenCalledWith("claude_code", "/demo");
    expect(screen.getByText("global CLAUDE.md")).toBeInTheDocument();
    expect(screen.getByText("this file")).toBeInTheDocument();
  });

  it("lists an artifact the prompt names, and not one it merely resembles", async () => {
    setup(true);
    getFileDetail.mockResolvedValue({
      status: "ok",
      data: { ...detail, content: "Use the adapt skill for adaptive layouts." },
    });
    render(<Detail fileId="f1" navigate={() => {}} />);

    expect(await screen.findByText("adapt")).toBeInTheDocument();
    expect(screen.getByText("never used")).toBeInTheDocument();
  });

  it("says nothing is referenced rather than leaving the section blank", async () => {
    setup(true);
    render(<Detail fileId="f1" navigate={() => {}} />);

    expect(
      await screen.findByText("No skills, agents, commands, MCP servers or plugins referenced by name"),
    ).toBeInTheDocument();
  });

  it("admits the rule stack is unreadable rather than claiming nothing applies", async () => {
    setup(true);
    getEffectiveRules.mockResolvedValue({ status: "error", error: "no db" });
    render(<Detail fileId="f1" navigate={() => {}} />);

    expect(await screen.findByText("Couldn't read the rule stack")).toBeInTheDocument();
    expect(screen.queryByText("No rule files apply here.")).not.toBeInTheDocument();
    // The rest of the panel — the file's layer and what it names — still stands.
    expect(screen.getByText("Project rules — loaded after global")).toBeInTheDocument();
  });

  it("shows one muted line and keeps the rest of Detail when setup is unreadable", async () => {
    setup(true);
    getSetup.mockResolvedValue({ status: "error", error: "no db" });
    render(<Detail fileId="f1" navigate={() => {}} />);

    expect(await screen.findByText("Setup not available")).toBeInTheDocument();
    expect(screen.getByText("File scorecard")).toBeInTheDocument();
    expect(screen.getAllByText("Deprecated model reference").length).toBeGreaterThan(0);
  });
});
