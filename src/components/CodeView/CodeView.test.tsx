import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { CodeView } from "./index";

afterEach(cleanup);

const JSON_SOURCE = '{\n  "command": "npx",\n  "args": ["-y"]\n}';

describe("CodeView", () => {
  it("draws one row per line, numbered from 1", () => {
    const { container } = render(<CodeView content={JSON_SOURCE} language="json" ariaLabel="source" />);
    const numbers = [...container.querySelectorAll(".cv__num")].map((n) => n.textContent);
    expect(numbers).toEqual(["1", "2", "3", "4"]);
  });

  it("keeps the text of every line intact", () => {
    const { container } = render(<CodeView content={JSON_SOURCE} language="json" ariaLabel="source" />);
    const lines = [...container.querySelectorAll(".cv__text")].map((l) => l.textContent);
    expect(lines).toEqual(JSON_SOURCE.split("\n"));
  });

  it("hides the line numbers from assistive tech and from find", () => {
    // A screen reader reading "1 {  2 "command"…" is noise, and a search for
    // "2" must not match the gutter.
    const { container } = render(<CodeView content={"a\nb"} language={null} ariaLabel="source" />);
    for (const num of container.querySelectorAll(".cv__num")) {
      expect(num).toHaveAttribute("aria-hidden", "true");
      expect(num).toHaveAttribute("data-find-skip");
    }
  });

  it("marks each line as its own block, so find never matches across two", () => {
    const { container } = render(<CodeView content={"a\nb"} language={null} ariaLabel="source" />);
    expect(container.querySelectorAll("[data-find-block]")).toHaveLength(2);
  });

  it("colours tokens with their highlight.js classes", () => {
    const { container } = render(<CodeView content={JSON_SOURCE} language="json" ariaLabel="source" />);
    expect(container.querySelector(".hljs-attr")?.textContent).toBe('"command"');
  });

  it("draws plain text with no highlight spans", () => {
    const { container } = render(<CodeView content="plain text" language={null} ariaLabel="source" />);
    expect(container.querySelector("[class^='hljs']")).toBeNull();
    expect(container.querySelector(".cv__text")?.textContent).toBe("plain text");
  });

  it("names the region", () => {
    render(<CodeView content="x" language={null} ariaLabel="SKILL.md source" />);
    expect(screen.getByRole("region", { name: "SKILL.md source" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<CodeView content={JSON_SOURCE} language="json" ariaLabel="source" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
