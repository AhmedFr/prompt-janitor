import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  tags: string[];
}

export interface Post extends PostMeta {
  html: string;
}

const BLOG_DIR = path.join(process.cwd(), "content/blog");

/** Testable core: reads every .md in a directory, skips drafts, sorts desc. */
export async function loadPosts(dir: string): Promise<Post[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  const posts = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(dir, file), "utf8");
      const { data, content } = matter(raw);
      if (data.draft === true) return null;
      const html = String(await remark().use(remarkHtml).process(content));
      return {
        slug: file.replace(/\.md$/, ""),
        title: String(data.title),
        description: String(data.description),
        pubDate: new Date(data.pubDate),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        html,
      } satisfies Post;
    }),
  );
  return posts
    .filter((p): p is Post => p !== null)
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export async function getAllPosts(): Promise<Post[]> {
  return loadPosts(BLOG_DIR);
}

export async function getPost(slug: string): Promise<Post> {
  const post = (await getAllPosts()).find((p) => p.slug === slug);
  if (!post) throw new Error(`Unknown blog post: ${slug}`);
  return post;
}
