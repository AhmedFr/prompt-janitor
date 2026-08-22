import { describe, it, expect } from "vitest";
import { rankRows } from "./rankedList.util";
import type { RankedRow } from "./RankedList.types";

const row = (id: string, value: number): RankedRow => ({ id, label: id, value });

describe("rankRows", () => {
  it("sorts rows descending by value", () => {
    const { rows } = rankRows([row("a", 3), row("b", 9), row("c", 1)], 10);
    expect(rows.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("slices to the given limit after sorting", () => {
    const { rows } = rankRows([row("a", 3), row("b", 9), row("c", 1), row("d", 5)], 2);
    expect(rows.map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("reports the top value in the slice as max", () => {
    const { max } = rankRows([row("a", 3), row("b", 9), row("c", 1)], 2);
    expect(max).toBe(9);
  });

  it("a limit smaller than the top rows still reports the slice's own max", () => {
    const { max, rows } = rankRows([row("a", 3), row("b", 9), row("c", 1)], 1);
    expect(rows.map((r) => r.id)).toEqual(["b"]);
    expect(max).toBe(9);
  });

  it("returns max 0 for an empty input", () => {
    const { rows, max } = rankRows([], 10);
    expect(rows).toEqual([]);
    expect(max).toBe(0);
  });

  it("returns max 0 when the limit slices everything away", () => {
    const { rows, max } = rankRows([row("a", 3)], 0);
    expect(rows).toEqual([]);
    expect(max).toBe(0);
  });

  it("does not mutate the input array", () => {
    const input = [row("a", 3), row("b", 9)];
    rankRows(input, 10);
    expect(input.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("keeps rows with equal values in their original relative order", () => {
    const { rows } = rankRows([row("a", 5), row("b", 5), row("c", 5)], 10);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
