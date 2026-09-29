import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SetupRow } from "@/lib/setupRows";
import { ItemUsage } from "./ItemUsage";

const skill = { id: 4, kind: "skill", name: "adapt", bytes: 900, origin: "inventory", usage: { total: 3, sessions: 2,
  last_used: "2026-09-26T09:00:00Z", error_rate: 0.33, avg_turn_tokens: 2000, count_30d: 3, count_prev_30d: 0 } } as SetupRow;
const usage = {
  window_days: 30,
  per_day: [{ day: "2026-09-25", uses: 2, errors: 1 }, { day: "2026-09-26", uses: 1, errors: 0 }],
  by_project: [{ path: "/code/web", name: "web", uses: 2, sessions: 1 }, { path: "/code/api", name: "api", uses: 1, sessions: 1 }],
  avg_turn_tokens: 2000,
};

describe("ItemUsage", () => {
  afterEach(cleanup);

  it("shows the per-project split, each project switching the lens", () => {
    const onSelect = vi.fn();
    render(<ItemUsage item={skill} loadedIn={[]} onSelectProject={onSelect} usage={usage} />);
    fireEvent.click(screen.getByRole("button", { name: /web/ }));
    expect(onSelect).toHaveBeenCalledWith("/code/web");
  });

  it("shows average tokens per turn and last used", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-27T09:00:00Z"));
    try {
      render(<ItemUsage item={skill} loadedIn={[]} onSelectProject={vi.fn()} usage={usage} />);
      expect(screen.getByText(/2,000|2\.0k/)).toBeInTheDocument();
      // last_used 2026-09-26T09:00Z, one day before "now"
      expect(screen.getByText("Last used").nextElementSibling).toHaveTextContent("1d");
    } finally {
      vi.useRealTimers();
    }
  });

  it("charts uses and the error rate, not an error count", () => {
    render(<ItemUsage item={skill} loadedIn={[]} onSelectProject={vi.fn()} usage={usage} />);
    expect(screen.getByRole("img", { name: "Uses per day" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Error rate per day" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Errors per day/ })).toBeNull();
  });

  it("for an instruction file, shows its token cost and the projects that load it", () => {
    const rule = { ...skill, kind: "rule", bytes: 4000, usage: null } as SetupRow;
    render(<ItemUsage item={rule} loadedIn={[{ path: "/code/web", name: "web" }]} onSelectProject={vi.fn()} usage={null} />);
    expect(screen.getByText(/≈1,000 tokens|≈1\.0k tokens/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "web" })).toBeInTheDocument();
  });

  it("says a hook has no usage", () => {
    render(<ItemUsage item={{ ...skill, kind: "hook" } as SetupRow} loadedIn={[]} onSelectProject={vi.fn()} usage={null} />);
    expect(screen.getByText("No usage for this kind.")).toBeInTheDocument();
  });
});
