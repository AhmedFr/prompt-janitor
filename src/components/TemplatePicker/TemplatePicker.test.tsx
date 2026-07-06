import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { TemplateInfo } from "@/lib/ipc";
import { TemplatePicker } from "./TemplatePicker";
import type { ApplyOutcome, TemplatePickerProps } from "./TemplatePicker.types";

const openExternal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/open-external", () => ({ openExternal }));

const templates: TemplateInfo[] = [
  {
    id: "react-ts-claude",
    stack: "react-ts",
    file_type: "CLAUDE.md",
    title: "React + TypeScript — CLAUDE.md",
    description: "Role, pnpm commands, output format, and a worked example.",
    preview: "# CLAUDE.md — React + TypeScript (pnpm)\n\nYou are a senior React engineer.\n",
  },
  {
    id: "rust-agents",
    stack: "rust",
    file_type: "AGENTS.md",
    title: "Rust — AGENTS.md",
    description: "Setup, build/test commands, and verification steps.",
    preview: "# AGENTS.md — Rust (cargo)\n\nYou are an autonomous coding agent.\n",
  },
];

function renderPicker(overrides: Partial<TemplatePickerProps> = {}) {
  const props: TemplatePickerProps = {
    templates,
    entitled: false,
    loading: false,
    onApply: vi.fn(async (): Promise<ApplyOutcome> => ({ status: "cancelled" })),
    onClose: () => {},
    navigate: () => {},
    ...overrides,
  };
  return { props, ...render(<TemplatePicker {...props} />) };
}

beforeEach(() => {
  openExternal.mockClear();
});

afterEach(cleanup);

describe("TemplatePicker — free (locked)", () => {
  it("shows the full preview of the first template without gating reading", () => {
    renderPicker();
    expect(screen.getByText(/You are a senior React engineer/)).toBeInTheDocument();
  });

  it("switches the preview when a different template is selected", () => {
    renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Rust AGENTS.md" }));
    expect(screen.getByText(/You are an autonomous coding agent/)).toBeInTheDocument();
  });

  it("opens checkout instead of applying when locked", async () => {
    const onApply = vi.fn(async (): Promise<ApplyOutcome> => ({ status: "cancelled" }));
    renderPicker({ onApply });
    fireEvent.click(screen.getByRole("button", { name: /Get Pro/ }));
    await waitFor(() => expect(openExternal).toHaveBeenCalledWith(expect.stringContaining("polar")));
    expect(onApply).not.toHaveBeenCalled();
  });

  it("offers the paste-a-key escape hatch into Settings → License", () => {
    const navigate = vi.fn();
    const onClose = vi.fn();
    renderPicker({ navigate, onClose });
    fireEvent.click(screen.getByText("Settings → License"));
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("settings", "license");
  });
});

describe("TemplatePicker — entitled", () => {
  it("applies the selected template and shows the success state", async () => {
    const onApply = vi.fn(
      async (): Promise<ApplyOutcome> => ({ status: "done", path: "/demo/CLAUDE.md", fileId: "f9" }),
    );
    renderPicker({ entitled: true, onApply });

    fireEvent.click(screen.getByRole("button", { name: /Use this template/ }));
    expect(await screen.findByText("Added CLAUDE.md")).toBeInTheDocument();
    expect(onApply).toHaveBeenCalledWith("react-ts-claude");
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("navigates to Detail when the applied file was scanned and id'd", async () => {
    const navigate = vi.fn();
    const onClose = vi.fn();
    const onApply = vi.fn(
      async (): Promise<ApplyOutcome> => ({ status: "done", path: "/demo/CLAUDE.md", fileId: "f9" }),
    );
    renderPicker({ entitled: true, onApply, navigate, onClose });

    fireEvent.click(screen.getByRole("button", { name: /Use this template/ }));
    fireEvent.click(await screen.findByRole("button", { name: "View in Detail" }));
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("detail", "f9");
  });

  it("falls back to Prompts when the applied file couldn't be matched after rescan", async () => {
    const navigate = vi.fn();
    const onApply = vi.fn(
      async (): Promise<ApplyOutcome> => ({ status: "done", path: "/outside/CLAUDE.md", fileId: null }),
    );
    renderPicker({ entitled: true, onApply, navigate });

    fireEvent.click(screen.getByRole("button", { name: /Use this template/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Back to Prompts" }));
    expect(navigate).toHaveBeenCalledWith("prompts", undefined);
  });

  it("surfaces an apply error instead of silently doing nothing", async () => {
    const onApply = vi.fn(
      async (): Promise<ApplyOutcome> => ({ status: "error", message: "CLAUDE.md already exists there." }),
    );
    renderPicker({ entitled: true, onApply });

    fireEvent.click(screen.getByRole("button", { name: /Use this template/ }));
    expect(await screen.findByText("CLAUDE.md already exists there.")).toBeInTheDocument();
  });

  it("does nothing when the user cancels the folder picker", async () => {
    const onApply = vi.fn(async (): Promise<ApplyOutcome> => ({ status: "cancelled" }));
    renderPicker({ entitled: true, onApply });

    fireEvent.click(screen.getByRole("button", { name: /Use this template/ }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(screen.queryByText(/Added/)).not.toBeInTheDocument();
  });
});

describe("TemplatePicker — loading and dismissal", () => {
  it("shows a loading state before the catalog arrives", () => {
    renderPicker({ loading: true, templates: [] });
    expect(screen.getByText("Loading templates…")).toBeInTheDocument();
  });

  it("closes without applying anything when dismissed", () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    renderPicker({ onClose, onApply });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
