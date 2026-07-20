import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPosts } from "./blog";

async function fixtureDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pj-blog-"));
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "older-post.md"),
    `---\ntitle: "Older"\ndescription: "old"\npubDate: 2026-07-01\ntags: ["a"]\n---\nBody **old**.\n`,
  );
  await writeFile(
    path.join(dir, "newer-post.md"),
    `---\ntitle: "Newer"\ndescription: "new"\npubDate: 2026-07-10\n---\nBody _new_.\n`,
  );
  await writeFile(
    path.join(dir, "hidden-post.md"),
    `---\ntitle: "Hidden"\ndescription: "x"\npubDate: 2026-07-05\ndraft: true\n---\nnope\n`,
  );
  return dir;
}

describe("loadPosts", () => {
  it("skips drafts and sorts newest first, slug = filename", async () => {
    const posts = await loadPosts(await fixtureDir());
    expect(posts.map((p) => p.slug)).toEqual(["newer-post", "older-post"]);
    expect(posts[0].title).toBe("Newer");
    expect(posts[1].tags).toEqual(["a"]);
    expect(posts[0].pubDate).toBeInstanceOf(Date);
  });

  it("renders markdown to HTML", async () => {
    const posts = await loadPosts(await fixtureDir());
    const older = posts.find((p) => p.slug === "older-post")!;
    expect(older.html).toContain("<strong>old</strong>");
  });
});
