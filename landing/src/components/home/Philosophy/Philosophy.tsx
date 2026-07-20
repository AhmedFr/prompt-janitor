export function Philosophy() {
  return (
    <section className="section tint philosophy">
      <div className="wrap">
        <div className="eyebrow">Why we're building this</div>
        <blockquote>
          “Prompt files are infrastructure.
          <br />
          Nobody inspects them.”
        </blockquote>
        <p className="who">
          Your agents read these files on every single run, yet there's no linter, no review, no grade. We think
          diagnosis should be free, for everyone, forever. Treatment is what you pay for.
        </p>
        <a className="ev-link" href="/blog/diagnosis-should-be-free">
          Read the manifesto →
        </a>
      </div>
    </section>
  );
}
