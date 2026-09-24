import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/ipc";
import type { SkillSource } from "./SkillPanel.types";

/**
 * The phrase Rust uses when it refuses a save because the file changed under
 * the panel. Matched rather than typed as a variant because the IPC error
 * channel is a plain string; if the wording drifts, the fallback is one
 * missed courtesy re-read, not a broken save.
 */
const CONFLICT_MARKER = "changed on disk";

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
  // The file's modification stamp as of the read the panel is showing. Sent
  // back on save so Rust can refuse to overwrite a file something else has
  // changed since — there is no undo, so a silent clobber is unrecoverable.
  const [modified, setModified] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumped by every read; a result whose token is no longer current is stale.
  const token = useRef(0);

  const read = useCallback(
    async (id: number, { quiet = false }: { quiet?: boolean } = {}) => {
      const mine = (token.current += 1);
      if (!quiet) {
        setLoading(true);
        setError(null);
        setContent(null);
        setPath(null);
        setModified(null);
      }

      const result = await commands.getArtifactSource(id);
      if (token.current !== mine) return;
      if (result.status === "ok") {
        setContent(result.data.content);
        setPath(result.data.path);
        setModified(result.data.modified);
      } else if (!quiet) {
        // A quiet re-read is a courtesy after a conflict; if it fails, the
        // conflict message is the more useful thing to leave on screen.
        setError(result.error);
      }
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    void read(artifactId);
  }, [artifactId, read]);

  const save = useCallback(
    async (next: string) => {
      setSaving(true);
      setError(null);
      const result = await commands.saveArtifactSource(artifactId, next, modified);
      setSaving(false);
      if (result.status !== "ok") {
        setError(result.error);
        // A rejected save means the file moved underneath us, so what the
        // panel is showing is out of date. Pull the current version in behind
        // the error: the user can then see what actually changed, and a second
        // attempt carries a stamp that will be accepted.
        if (result.error.includes(CONFLICT_MARKER)) await read(artifactId, { quiet: true });
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
    [artifactId, modified, read],
  );

  return { content, path, modified, loading, saving, error, save };
}
