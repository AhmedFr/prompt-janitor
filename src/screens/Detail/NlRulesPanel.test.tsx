import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { NlRulesPanel } from "./NlRulesPanel";

const { evaluateNlRules } = vi.hoisted(() => ({ evaluateNlRules: vi.fn() }));
vi.mock("@/lib/ipc", () => ({
  commands: { evaluateNlRules },
}));

describe("NlRulesPanel", () => {
  it("ignores a stale evaluate_nl_rules response after navigating to a different file (#94 P1)", async () => {
    let resolveA!: (value: unknown) => void;
    const pendingA = new Promise((resolve) => {
      resolveA = resolve;
    });
    evaluateNlRules.mockReturnValueOnce(pendingA);

    const onAppliedA = vi.fn();
    const { rerender } = render(
      <NlRulesPanel fileId="file-a" content="content a" onApplied={onAppliedA} />,
    );

    fireEvent.click(screen.getByText("Check standards"));
    expect(evaluateNlRules).toHaveBeenCalledWith("file-a");

    // Navigate to a different file before file A's slow AI round-trip
    // resolves — this is the race: the panel is now showing file B.
    const onAppliedB = vi.fn();
    rerender(<NlRulesPanel fileId="file-b" content="content b" onApplied={onAppliedB} />);

    // File A's response finally arrives.
    await act(async () => {
      resolveA({
        status: "ok",
        data: {
          verdicts: [
            {
              rule_id: "stale-rule",
              title: "Stale verdict from file A",
              severity: "mid",
              source: "anthropic",
              violates: true,
              explanation: "Should never be shown for file B.",
            },
          ],
          score: 10,
          grade: "F",
        },
      });
      await pendingA;
    });

    // Neither callback fires against the now-stale request, and file B's
    // panel must not show file A's verdicts or score.
    expect(onAppliedA).not.toHaveBeenCalled();
    expect(onAppliedB).not.toHaveBeenCalled();
    expect(screen.queryByText("Stale verdict from file A")).not.toBeInTheDocument();
    expect(screen.queryByText(/Score is now/)).not.toBeInTheDocument();
  });
});
