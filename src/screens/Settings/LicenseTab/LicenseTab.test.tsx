import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { LicenseTab } from "./LicenseTab";
import type { Entitlement } from "@/lib/ipc";

// Matches what the Rust core actually sends while gates are open: `paid` is
// always true so nothing is turned away, but `plan` is "open" — that's the
// signal the UI must key off, not `paid`.
const openEntitlement: Entitlement = { paid: true, email: null, plan: "open" };
const licensedEntitlement: Entitlement = { paid: true, email: "a@b.c", plan: "lifetime" };

describe("LicenseTab", () => {
  afterEach(cleanup);

  it("shows the open notice and paste-key form when gates are open (no real license)", () => {
    const { getByText, getByPlaceholderText, queryByText } = render(
      <LicenseTab entitlement={openEntitlement} onActivate={async () => ""} onRemove={async () => {}} />,
    );
    expect(getByText(/All features are currently open — no license needed\./)).toBeInTheDocument();
    expect(getByPlaceholderText("PJ1.…")).toBeInTheDocument();
    expect(queryByText(/Remove license/)).not.toBeInTheDocument();
  });

  it("shows the Remove license action for a real licensed entitlement", () => {
    const { getByText, queryByPlaceholderText } = render(
      <LicenseTab entitlement={licensedEntitlement} onActivate={async () => ""} onRemove={async () => {}} />,
    );
    expect(getByText(/Remove license/)).toBeInTheDocument();
    expect(queryByPlaceholderText("PJ1.…")).not.toBeInTheDocument();
  });
});
