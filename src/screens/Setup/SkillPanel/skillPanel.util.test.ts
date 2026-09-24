import { describe, it, expect } from "vitest";
import { splitFrontmatter } from "./skillPanel.util";

describe("splitFrontmatter", () => {
  it("separates a leading --- block from the body", () => {
    expect(splitFrontmatter("---\nname: adapt\n---\n# Title\n")).toEqual({
      fields: [["name", "adapt"]],
      body: "# Title\n",
    });
  });

  it("keeps the fields in the order the file wrote them", () => {
    const { fields } = splitFrontmatter("---\nname: adapt\ndescription: does things\n---\nbody");
    expect(fields).toEqual([
      ["name", "adapt"],
      ["description", "does things"],
    ]);
  });

  it("keeps a colon inside a value", () => {
    const { fields } = splitFrontmatter("---\nwhen: use when: it applies\n---\nbody");
    expect(fields).toEqual([["when", "use when: it applies"]]);
  });

  it("strips wrapping quotes from a value", () => {
    const { fields } = splitFrontmatter('---\nname: "adapt"\n---\nbody');
    expect(fields).toEqual([["name", "adapt"]]);
  });

  it("returns the whole document as body when there is no frontmatter", () => {
    expect(splitFrontmatter("# Title\n")).toEqual({ fields: [], body: "# Title\n" });
  });

  it("does not treat a --- later in the document as frontmatter", () => {
    expect(splitFrontmatter("# Title\n\n---\n\nmore")).toEqual({
      fields: [],
      body: "# Title\n\n---\n\nmore",
    });
  });

  it("treats an unterminated frontmatter block as body, losing nothing", () => {
    expect(splitFrontmatter("---\nname: adapt\nno end")).toEqual({
      fields: [],
      body: "---\nname: adapt\nno end",
    });
  });

  it("ignores lines in the block that are not `key: value`", () => {
    const { fields } = splitFrontmatter("---\nname: adapt\n  - nested\n---\nbody");
    expect(fields).toEqual([["name", "adapt"]]);
  });

  it("handles an empty frontmatter block", () => {
    expect(splitFrontmatter("---\n---\nbody")).toEqual({ fields: [], body: "body" });
  });
});
