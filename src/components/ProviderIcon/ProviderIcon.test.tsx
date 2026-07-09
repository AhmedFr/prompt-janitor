import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ProviderIcon } from "./ProviderIcon";

describe("ProviderIcon", () => {
  afterEach(cleanup);

  it("labels known kinds by provider", () => {
    const { getByRole } = render(<ProviderIcon kind="CLAUDE.md" />);
    expect(getByRole("img")).toHaveAttribute("aria-label", "Claude");
  });

  it("labels .cursorrules as Cursor", () => {
    const { getByRole } = render(<ProviderIcon kind=".cursorrules" />);
    expect(getByRole("img")).toHaveAttribute("aria-label", "Cursor");
  });

  it("falls back to File for unknown kinds", () => {
    const { getByRole } = render(<ProviderIcon kind="whatever" />);
    expect(getByRole("img")).toHaveAttribute("aria-label", "File");
  });
});
