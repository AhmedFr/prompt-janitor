import { describe, expect, it } from "vitest";
import { sessionsByProject } from "./projects.util";

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
