import { BrushCleaningIcon } from "@/components/BrushCleaningIcon";

export function Nav() {
  return (
    <nav className="nav">
      <div className="wrap">
        <a className="brand" href="/#hero">
          <span className="logo" aria-hidden="true">
            <BrushCleaningIcon />
          </span>
          Prompt Janitor
        </a>
        <div className="nav-links">
          <a href="/#features">Features</a>
          <a href="/#pricing">Pricing</a>
          <a href="/blog">Blog</a>
          <a href="/#faq">FAQ</a>
          <a className="btn sm" href="/#hero">
            Join waitlist
          </a>
        </div>
      </div>
    </nav>
  );
}
