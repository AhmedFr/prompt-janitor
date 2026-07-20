"use client";

import { useEffect } from "react";
import { sendGAEvent } from "@next/third-parties/google";

export function AnalyticsClicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.("a.btn, a.ev-link");
      if (a) sendGAEvent("event", "cta_click", { href: a.getAttribute("href") ?? "" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
