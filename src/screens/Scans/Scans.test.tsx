import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { Scans } from "./Scans";
import type { ScansDigest } from "@/lib/ipc";

vi.mock("@/lib/ipc", async (orig) => {
  const mod = await orig<typeof import("@/lib/ipc")>();
  return { ...mod, isTauri: true };
});

const baseDigest: ScansDigest = {
  has_data: true,
  overall_grade: "B",
  net_health: 3,
  improved: 2,
  regressed: 1,
  scan_count: 4,
  trend: [70, 73],
  needs_attention: [],
  skipped_lines: 0,
};

const mockUseScansDigest = vi.fn(() => ({ digest: baseDigest, loading: false }));
vi.mock("./useScansDigest", async (orig) => {
  const mod = await orig<typeof import("./useScansDigest")>();
  return { ...mod, useScansDigest: () => mockUseScansDigest() };
});

describe("Scans", () => {
  afterEach(() => {
    cleanup();
    mockUseScansDigest.mockReturnValue({ digest: baseDigest, loading: false });
  });

  it("stays silent about skipped lines when the scan parsed everything", () => {
    render(<Scans navigate={vi.fn()} />);
    expect(screen.queryByText(/skipped while indexing/i)).toBeNull();
  });

  it("owns up to log lines it could not index", () => {
    mockUseScansDigest.mockReturnValue({
      digest: { ...baseDigest, skipped_lines: 12 },
      loading: false,
    });
    render(<Scans navigate={vi.fn()} />);
    expect(screen.getByText("12 log lines skipped while indexing")).toBeTruthy();
  });

  it("counts a single skipped line in the singular", () => {
    mockUseScansDigest.mockReturnValue({
      digest: { ...baseDigest, skipped_lines: 1 },
      loading: false,
    });
    render(<Scans navigate={vi.fn()} />);
    expect(screen.getByText("1 log line skipped while indexing")).toBeTruthy();
  });

  it("points at the scan, not at a folder, when there is nothing yet", () => {
    mockUseScansDigest.mockReturnValue({
      digest: { ...baseDigest, has_data: false },
      loading: false,
    });
    render(<Scans navigate={vi.fn()} />);
    expect(screen.getByText("No scans yet — run a scan from the Overview tab.")).toBeTruthy();
  });

  // An empty digest can still be the *result* of a scan that could not read
  // its logs; hiding the caveat there hides the reason.
  it("owns up to skipped lines even when the digest is empty", () => {
    mockUseScansDigest.mockReturnValue({
      digest: { ...baseDigest, has_data: false, skipped_lines: 4 },
      loading: false,
    });
    render(<Scans navigate={vi.fn()} />);
    expect(screen.getByText("4 log lines skipped while indexing")).toBeTruthy();
  });
});
