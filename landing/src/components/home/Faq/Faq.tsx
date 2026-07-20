"use client";

import { useState, type ReactNode } from "react";

interface FaqItem {
  q: string;
  a: ReactNode;
}

const ITEMS: FaqItem[] = [
  {
    q: "When does it launch?",
    a: "Soon. Prompt Janitor is in pre-launch: join the waitlist and you'll get the download link the moment it ships, with the launch sale price ($19 instead of $30) locked in. Pricing isn't definitive yet and may change before launch.",
  },
  {
    q: "What happens when I join the waitlist?",
    a: "You get one confirmation email right away, and one email when the app launches. That's the whole campaign: no drip sequences, and you can unsubscribe any time.",
  },
  {
    q: "What does Prompt Janitor scan?",
    a: (
      <>
        Prompt and agent-instruction files in the folders you choose:{" "}
        <span style={{ fontFamily: "var(--mono)", fontSize: ".9em" }}>AGENTS.md</span>,{" "}
        <span style={{ fontFamily: "var(--mono)", fontSize: ".9em" }}>CLAUDE.md</span>,{" "}
        <span style={{ fontFamily: "var(--mono)", fontSize: ".9em" }}>.cursorrules</span> and more.
      </>
    ),
  },
  {
    q: "Does it send my prompts anywhere?",
    a: "No. Scanning and grading run entirely on your Mac. Nothing is uploaded. Prompt Janitor is local-first by design.",
  },
  {
    q: "What standards does it grade against?",
    a: "Built-in rule packs distilled from Anthropic and OpenAI guidance and respected practitioners, plus any custom rules you write yourself.",
  },
  {
    q: "Can I write my own rules?",
    a: "Yes, in plain English, with a severity level. They're checked on every scan, right next to the built-ins.",
  },
  {
    q: "How often does it scan?",
    a: "On a schedule you set: hourly, every 6 hours, daily, on file save (watch mode), or manually whenever you click.",
  },
  {
    q: "What's free, what's paid?",
    a: (
      <>
        Diagnosis is free, forever: scanning, scheduling, watch mode, notifications, history &amp; trends (no scan caps, ever), plus
        every deterministic fact rule with cited findings. The built-in 25-standard AI catalog evaluation is free too when you bring your
        own compute (local Ollama or your API key), and findings are never hidden or blurred. Treatment is Pro: grading against{" "}
        <i>your</i> standards, AI rewrites, and applying fixes.
      </>
    ),
  },
  {
    q: "Is it a subscription?",
    a: "No. Pro is a one-time purchase: perpetual license + 12 months of feature updates. After that there's a $29/yr optional renewal for continued updates, never required to keep using the app.",
  },
  {
    q: "How do I get my license key?",
    a: (
      <>
        Checkout runs through Polar, our merchant of record. Right after purchase, Polar emails you a license key. Paste it into
        Settings → License and Pro unlocks. Keys are verified offline; no account needed.
      </>
    ),
  },
  {
    q: "What's the guarantee?",
    a: "If your prompt-file health doesn't go up a full letter grade within 30 days, full refund.",
  },
  {
    q: "Will it change my files?",
    a: "Only when you apply a fix, and it snapshots a backup first, with one-click undo and an optional dedicated git branch so changes stay reviewable.",
  },
  {
    q: "How do I get the app?",
    a: "It's pre-launch. Join the waitlist and you'll be scanning within a minute of the launch email. No account, no sign-up.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <section className="section tint" id="faq">
      <div className="wrap">
        <div className="section-head">
          <h2>Frequently asked questions</h2>
          <p>Privacy, compatibility, and how grading actually works.</p>
        </div>
        <div className="faq" id="faqList">
          {ITEMS.map((item, i) => (
            <div className={open.has(i) ? "acc open" : "acc"} key={item.q}>
              <button className="acc-q" aria-expanded={open.has(i)} onClick={() => toggle(i)}>
                {item.q}
                <span className="pm" aria-hidden="true">
                  +
                </span>
              </button>
              <div className="acc-a">
                <div>{item.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
