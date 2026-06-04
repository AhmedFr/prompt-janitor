// Registers jest-dom matchers (e.g. toBeInTheDocument) on Vitest's expect.
import "@testing-library/jest-dom/vitest";

// Registers the axe accessibility matcher (toHaveNoViolations).
import * as axeMatchers from "vitest-axe/matchers";
import type { AxeMatchers } from "vitest-axe/matchers";
import { expect } from "vitest";
expect.extend(axeMatchers);

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
