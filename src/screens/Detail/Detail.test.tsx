import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { FileDetail } from "@/lib/ipc";
import { Detail } from "./Detail";

const openExternal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/open-external", () => ({ openExternal }));

const getFileDetail = vi.hoisted(() => vi.fn());
const getAiConfig = vi.hoisted(() => vi.fn());
const getEntitlement = vi.hoisted(() => vi.fn());
const hasBackup = vi.hoisted(() => vi.fn());
const applyFix = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());

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

function setup(entitled: boolean) {
  getFileDetail.mockResolvedValue({ status: "ok", data: detail });
  getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "none", model: "", has_key: false } });
  getEntitlement.mockResolvedValue({ status: "ok", data: { paid: entitled, email: null, plan: null } });
  hasBackup.mockResolvedValue({ status: "ok", data: false });
  scanNow.mockResolvedValue({ status: "ok", data: {} });
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
