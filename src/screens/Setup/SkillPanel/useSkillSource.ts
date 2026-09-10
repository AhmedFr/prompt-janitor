import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/ipc";
import type { SkillSource } from "./SkillPanel.types";

/**
 * Loads one skill's file and saves edits back to it.
 *
 * `content` is always what is *on disk* — the read's result, or the text of
 * the last save that landed. The editor's in-progress draft lives in the
 * component, not here, which is what makes "is this dirty?" a comparison of
 * two strings rather than a flag anyone has to remember to clear.
 *
 * Reads are sequenced by a token rather than cancelled: `AbortController`
 * cannot reach across an IPC call, so a stale read still resolves — it just
 * finds a token that has moved on and drops its result instead of painting
 * the previous skill's text into the panel the user is now looking at.
 */
export function useSkillSource(artifactId: number): SkillSource {
  const [content, setContent] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumped by every read; a result whose token is no longer current is stale.
  const token = useRef(0);

  useEffect(() => {
    const mine = (token.current += 1);
    setLoading(true);
    setError(null);
    setContent(null);
    setPath(null);

    void commands.getArtifactSource(artifactId).then((result) => {
      if (token.current !== mine) return;
      if (result.status === "ok") {
        setContent(result.data.content);
        setPath(result.data.path);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
  }, [artifactId]);

  const save = useCallback(
    async (next: string) => {
      setSaving(true);
      setError(null);
      const result = await commands.saveArtifactSource(artifactId, next);
      setSaving(false);
      if (result.status !== "ok") {
        setError(result.error);
        return null;
      }
      // The write landed, so `next` is now what is on disk — recording that
      // here is what makes the editor stop reading as dirty.
      setContent(next);
      // Rust's byte count, not `next.length`: the Size column means bytes and
      // a JS string length counts UTF-16 units, so any non-ASCII character in
      // the file would make the two disagree.
      return result.data.bytes;
    },
    [artifactId],
  );

  return { content, path, loading, saving, error, save };
}
