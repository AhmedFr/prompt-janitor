"use client";

import { useState } from "react";
import { sendGAEvent } from "@next/third-parties/google";
import { CONTACT_EMAIL } from "@/lib/constants";
import { DitherButton } from "@/components/dither-kit/button";
import type { WaitlistFormProps } from "./WaitlistForm.types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "busy" | "ok" | "err";

export function WaitlistForm({ source, buttonLabel = "Join the waitlist", compact = false }: WaitlistFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const website = (form.elements.namedItem("website") as HTMLInputElement).value;

    if (!EMAIL_RE.test(email)) {
      setStatus("err");
      setMessage("That email doesn't look right. Mind checking it?");
      return;
    }

    setStatus("busy");
    setMessage("Adding you…");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, website }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      sendGAEvent("event", "waitlist_submit", { source });
      setStatus("ok");
      setMessage("You're on the list, confirmation email on its way ✅");
      form.reset();
    } catch {
      setStatus("err");
      setMessage(`Something went wrong. Email us instead: ${CONTACT_EMAIL}`);
    }
  }

  return (
    <form className={compact ? "wl-form compact" : "wl-form"} onSubmit={onSubmit} noValidate>
      <input type="email" name="email" required placeholder="you@example.com" aria-label="Email address" autoComplete="email" />
      <input type="text" name="website" className="wl-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <DitherButton className="btn-dither" type="submit" disabled={status === "busy"} color="blue" variant="gradient" bloom="low">
        {buttonLabel}
      </DitherButton>
      <p className={status === "ok" ? "wl-msg ok" : status === "err" ? "wl-msg err" : "wl-msg"} role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
