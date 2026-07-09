import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Prompts } from "./Prompts";
import type { FileRow, ProjectRow } from "@/lib/ipc";

vi.mock("@/lib/ipc", async (orig) => {
  const mod = await orig<typeof import("@/lib/ipc")>();
  return {
    ...mod,
    isTauri: true,
    // useTemplatePicker (invoked by the still-present template flow) fires on
    // mount; stub its two calls so tests don't hit the real Tauri bridge.
    commands: {
      ...mod.commands,
      listTemplates: vi.fn().mockResolvedValue([]),
      getEntitlement: vi.fn().mockResolvedValue({ status: "ok", data: { paid: false, email: null, plan: null } }),
    },
  };
});

const projects: ProjectRow[] = [
  { id: "/api", name: "api", grade: "D", score: 52, file_count: 1, issue_count: 5, logo: null, modified: "200" },
];
const files: FileRow[] = [
  { id: "/api/CLAUDE.md", name: "CLAUDE.md", path: "/api/CLAUDE.md", project: "api", kind: "CLAUDE.md", grade: "D", score: 52, issue_count: 5, modified: "200" },
];
vi.mock("./usePromptsList", async (orig) => {
  const mod = await orig<typeof import("./usePromptsList")>();
  return { ...mod, usePromptsList: () => ({ files, projects, loading: false, refetch: vi.fn() }) };
});

describe("Prompts", () => {
  afterEach(cleanup);

  it("renders a project group with its file row", () => {
    const { getByText, getByRole } = render(<Prompts navigate={vi.fn()} />);
    expect(getByText("api")).toBeInTheDocument();
    expect(getByRole("button", { name: /CLAUDE\.md/ })).toBeInTheDocument();
  });

  it("navigates to detail on row click", () => {
    const navigate = vi.fn();
    const { getByRole } = render(<Prompts navigate={navigate} />);
    getByRole("button", { name: /CLAUDE\.md/ }).click();
    expect(navigate).toHaveBeenCalledWith("detail", "/api/CLAUDE.md");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Prompts navigate={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
