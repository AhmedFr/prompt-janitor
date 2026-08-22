import { describe, it, expect } from "vitest";
import { AA_CONTRAST, contrastRatio, parseHex, relativeLuminance } from "./contrast";

describe("parseHex", () => {
  it("reads both the short and the long form", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("0a84ff")).toEqual([10, 132, 255]);
  });

  it("rejects anything that is not a hex colour", () => {
    expect(() => parseHex("rgba(0,0,0,.2)")).toThrow(/not a hex colour/);
    expect(() => parseHex("#gggggg")).toThrow(/not a hex colour/);
  });
});

describe("relativeLuminance", () => {
  it("anchors at the WCAG reference luminances", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBe(1);
    // Mid grey sits well below 0.5: luminance is linearised, not perceptual.
    expect(relativeLuminance("#808080")).toBeCloseTo(0.2159, 3);
  });
});

describe("contrastRatio", () => {
  it("spans 1:1 for identical colours up to 21:1 for black on white", () => {
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("does not care which colour is the foreground", () => {
    expect(contrastRatio("#0060df", "#e2f0ff")).toBeCloseTo(
      contrastRatio("#e2f0ff", "#0060df"),
      10,
    );
  });

  it("exports the AA threshold it is used to check against", () => {
    expect(AA_CONTRAST).toBe(4.5);
  });
});
