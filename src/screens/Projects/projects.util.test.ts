import { describe, expect, it } from "vitest";
import type { SetupView } from "@/lib/ipc";
import { itemsAvailable, sessionsByProject } from "./projects.util";

const setup = {
  harnesses: [],
  global: [{}, {}, {}],
  projects: [
    { path: "/code/web", artifacts: [{}, {}] },
    { path: "/code/api", artifacts: [{}] },
  ],
} as unknown as SetupView;

describe("itemsAvailable", () => {
  it("counts everything global plus the project's own items", () => {
    expect(itemsAvailable("/code/web", setup)).toBe(5);
    expect(itemsAvailable("/code/web/", setup)).toBe(5);
  });
  it("counts only the global items for a project the inventory does not know", () => {
    expect(itemsAvailable("/code/other", setup)).toBe(3);
  });
  it("says nothing before the setup loads", () => {
    expect(itemsAvailable("/code/web", null)).toBeNull();
  });
});

describe("sessionsByProject", () => {
  it("keys the window's session counts by project path", () => {
    const m = sessionsByProject([
      { path: "/code/web/", name: "web", sessions: 7 },
      { path: "/code/api", name: "api", sessions: 2 },
    ]);
    expect(m.get("/code/web")).toBe(7);
    expect(m.get("/code/api")).toBe(2);
    expect(m.get("/code/other")).toBeUndefined();
  });
});
