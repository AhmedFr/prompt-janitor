export function Nav() {
  return (
    <nav className="nav">
      <div className="wrap">
        <a className="brand" href="/#hero">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="6" x2="19" y2="6" />
              <line x1="5" y1="11" x2="14" y2="11" />
              <line x1="5" y1="16" x2="9" y2="16" strokeOpacity=".5" />
              <path d="M15 15.5l1.5 1.5M16.5 15.5L15 17" strokeWidth="1.4" />
            </svg>
          </span>
          Prompt Janitor
        </a>
        <div className="nav-links">
          <a href="/#features">Features</a>
          <a href="/#pricing">Pricing</a>
          <a href="/blog">Blog</a>
          <a href="/#faq">FAQ</a>
          <a className="btn sm" href="/#pricing">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11" />
              <path d="M7 11l5 5 5-5" />
              <path d="M5 20h14" />
            </svg>{" "}
            Download
          </a>
        </div>
      </div>
    </nav>
  );
}
