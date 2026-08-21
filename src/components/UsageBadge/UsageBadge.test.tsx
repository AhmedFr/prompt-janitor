import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { UsageBadge } from "./UsageBadge";
import type { UsageStat } from "@/lib/ipc";

const now = new Date("2026-08-21T12:00:00Z");
const stat = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 42,
  sessions: 12,
  last_used: "2026-08-18T12:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: null,
  count_30d: 5,
  count_prev_30d: 3,
  ...o,
});

describe("UsageBadge", () => {
  afterEach(cleanup);

  it("renders the never-used label and tone for null usage", () => {
    render(<UsageBadge usage={null} now={now} />);
    expect(screen.getByText("never used")).toHaveAttribute("data-tone", "never");
  });

  it("renders the formatted label and used tone", () => {
    render(<UsageBadge usage={stat()} now={now} />);
    expect(screen.getByText("used 42× · 12 sessions · last 3d ago")).toHaveAttribute(
      "data-tone",
      "used",
    );
  });

  it("flags an error-prone artifact", () => {
    render(<UsageBadge usage={stat({ error_rate: 0.5 })} now={now} />);
    expect(screen.getByText(/used 42×/)).toHaveAttribute("data-tone", "error");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<UsageBadge usage={stat()} now={now} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
