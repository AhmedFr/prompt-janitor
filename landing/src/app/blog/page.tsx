import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — Prompt Janitor",
  description: "Field notes on prompt files, agent context, and measuring what actually works.",
};

const dateLabel = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export default async function BlogIndex() {
  const posts = await getAllPosts();
  return (
    <>
      <Nav />
      <main id="main">
        <section className="section">
          <div className="wrap" style={{ maxWidth: 760 }}>
            <div className="section-head">
              <div className="eyebrow">Blog</div>
              <h2 style={{ marginTop: 12 }}>Field notes on prompt health</h2>
              <p>Practical writing about prompt files, agent context, and evidence over vibes.</p>
            </div>
            <div className="post-list">
              {posts.map((post) => (
                <a className="post-card" href={`/blog/${post.slug}`} key={post.slug}>
                  <div className="faint post-date">{dateLabel(post.pubDate)}</div>
                  <h3>{post.title}</h3>
                  <p className="muted">{post.description}</p>
                  <span className="post-more">Read →</span>
                </a>
              ))}
              {posts.length === 0 && (
                <p className="muted" style={{ textAlign: "center" }}>
                  First posts landing shortly.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
