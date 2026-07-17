import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WaitlistForm } from "@/components/WaitlistForm";
import { getAllPosts, getPost } from "@/lib/blog";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getAllPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return {
    title: `${post.title} — Prompt Janitor`,
    description: post.description,
    openGraph: { type: "article" },
  };
}

const dateLabel = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  return (
    <>
      <Nav />
      <main id="main">
        <article className="section" style={{ paddingTop: 64 }}>
          <div className="wrap">
            <header className="post-header">
              <div className="eyebrow">Blog · {dateLabel(post.pubDate)}</div>
              <h1>{post.title}</h1>
              <p className="lead" style={{ maxWidth: 600, margin: "20px auto 0", color: "var(--ink-2)", fontSize: 19 }}>
                {post.description}
              </p>
            </header>
            <div className="prose" dangerouslySetInnerHTML={{ __html: post.html }} />
            <div className="post-cta">
              <h3 style={{ fontSize: 26 }}>Prompt Janitor is launching soon</h3>
              <p className="muted" style={{ margin: "12px 0 0" }}>
                Scan, grade, and fix every prompt file on your Mac. Waitlist members lock in founder pricing — $69
                instead of $99.
              </p>
              <WaitlistForm source={`blog-${post.slug}`} />
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
