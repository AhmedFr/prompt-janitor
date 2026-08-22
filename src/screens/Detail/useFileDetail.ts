import { useCallback, useEffect, useMemo, useState } from "react";
import { commands, isTauri, type EffectiveRule, type FileDetail, type SetupView } from "@/lib/ipc";
import type { MergePositionState } from "./MergePosition";
import {
  globalRuleStack,
  layerForPath,
  projectForPath,
  referenceCandidates,
  referencedArtifacts,
} from "./mergePosition.util";

/** Loads a single file's source + issues whenever the selected file changes. */
export function useFileDetail(fileId: string | null) {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiReady, setAiReady] = useState(false);
  const [entitled, setEntitled] = useState(false);

  /** Re-fetch the file from disk + DB (after an apply/undo, or a fresh scan). */
  const reload = useCallback(async () => {
    if (!isTauri || !fileId) return;
    const res = await commands.getFileDetail(fileId);
    setDetail(res.status === "ok" ? res.data : null);
  }, [fileId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isTauri || !fileId) {
        setDetail(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await commands.getFileDetail(fileId);
      if (!active) return;
      setDetail(res.status === "ok" ? res.data : null);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [fileId]);

  // Provider config + entitlement are stable across files — load once. A rewrite
  // needs a provider + key (or `suggest_fix` fails) AND a paid license (or it's
  // gated server-side).
  useEffect(() => {
    let active = true;
    async function loadGates() {
      if (!isTauri) return;
      const [cfg, ent] = await Promise.all([commands.getAiConfig(), commands.getEntitlement()]);
      if (!active) return;
      if (cfg.status === "ok") setAiReady(cfg.data.provider !== "none" && cfg.data.has_key);
      if (ent.status === "ok") setEntitled(ent.data.paid);
    }
    void loadGates();
    return () => {
      active = false;
    };
  }, []);

  const mergePosition = useMergePosition(detail);

  return { detail, loading, aiReady, entitled, reload, mergePosition };
}

/**
 * Places the viewed file in its harness's merge order.
 *
 * The whole setup inventory is fetched once per mount — it does not change
 * while the user reads one file, and re-fetching it on every reload would pay
 * for a full inventory walk to redraw an unchanged panel. Setup's `useSetup`
 * fetches the same view; a shared cache across screens is a later refactor.
 */
function useMergePosition(detail: FileDetail | null): MergePositionState {
  const [setup, setSetup] = useState<SetupView | null>(null);
  // A failed lookup is not an empty setup: reporting `null` here would leave the
  // panel spinning forever, and `[]` would claim nothing applies to the file.
  const [failed, setFailed] = useState(false);
  // `"error"` is a third answer, distinct from "not loaded yet" and "empty":
  // the panel must say it could not look rather than that nothing applies.
  const [effective, setEffective] = useState<EffectiveRule[] | "error" | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSetup() {
      if (!isTauri) return;
      try {
        const res = await commands.getSetup();
        if (!active) return;
        if (res.status === "ok") setSetup(res.data);
        else setFailed(true);
      } catch {
        if (active) setFailed(true);
      }
    }
    void loadSetup();
    return () => {
      active = false;
    };
  }, []);

  const project = useMemo(
    () => (detail && setup ? projectForPath(detail.path, setup.projects) : null),
    [detail, setup],
  );
  // Depend on the identifying strings, not the row object: `detail` is a fresh
  // object after every reload, and the stack has not moved because a fix landed.
  const harness = project?.harness ?? null;
  const projectPath = project?.path ?? null;

  useEffect(() => {
    let active = true;
    async function loadRules() {
      if (!isTauri || !harness || !projectPath) {
        setEffective(null);
        return;
      }
      setEffective(null);
      try {
        const res = await commands.getEffectiveRules(harness, projectPath);
        if (!active) return;
        // The stack is one section of the panel; losing it is not worth
        // discarding the file's layer and its referenced artifacts too.
        setEffective(res.status === "ok" ? res.data : "error");
      } catch {
        if (active) setEffective("error");
      }
    }
    void loadRules();
    return () => {
      active = false;
    };
  }, [harness, projectPath]);

  return useMemo<MergePositionState>(() => {
    if (failed) return "error";
    if (!detail || !setup) return null;
    const layer = layerForPath(detail.path, setup.global);
    // A global rule file has no project stack to ask for, so it never waits on
    // one; a project file holds the panel back until its stack has arrived.
    if (layer === "project" && project && effective === null) return null;
    const stack =
      layer === "global" ? globalRuleStack(detail.path, setup.global) : (effective ?? []);
    return {
      layer,
      project: project ? { name: project.name, path: project.path } : null,
      filePath: detail.path,
      effective: stack,
      // A file the merged stack never names is read only inside its own folder,
      // whatever layer it nominally belongs to.
      inStack: stack !== "error" && stack.some((rule) => rule.path === detail.path),
      referenced: referencedArtifacts(
        detail.content,
        referenceCandidates(setup.global, project, detail.path),
      ),
    };
  }, [detail, setup, project, effective, failed]);
}
