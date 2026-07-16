export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-cols">
          <div>
            <a className="brand" href="/#hero" style={{ marginBottom: 12 }}>
              <span className="logo" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="6" x2="19" y2="6" />
                  <line x1="5" y1="11" x2="14" y2="11" />
                  <line x1="5" y1="16" x2="9" y2="16" strokeOpacity=".5" />
                  <path d="M15 15.5l1.5 1.5M16.5 15.5L15 17" strokeWidth="1.4" />
                </svg>
              </span>{" "}
              Prompt Janitor
            </a>
            <p className="faint" style={{ fontSize: "14.5px", maxWidth: "30ch", margin: 0 }}>
              The visibility layer for every prompt on your Mac.
            </p>
          </div>
          <div>
            <h5>Product</h5>
            <a href="/#features">Features</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#faq">FAQ</a>
          </div>
          <div>
            <h5>Resources</h5>
            <a href="/blog">Blog</a>
            <a href="/rss.xml">RSS</a>
            <a href="mailto:prompt-janitor@studiotristar.com">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {year} Prompt Janitor — All rights reserved</span>
          <span>Built for people who care about their prompts</span>
        </div>
      </div>
    </footer>
  );
}
