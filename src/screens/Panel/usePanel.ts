import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { commands, isTauri, type PanelSnapshot } from "@/lib/ipc";
import { useScanProgress } from "@/lib/useScanProgress";
import type { PanelState } from "./Panel.types";

/**
 * Everything the menu-bar popover needs to stay honest while it is open: the
 * snapshot, a refetch on every re-show (the panel is given focus each time the
 * tray icon opens it) and on `scan-done`, the running scan's progress, and Esc
 * to dismiss.
 *
 * The panel window is created once at startup and only hidden, so a stale
 * snapshot would otherwise survive for as long as the app runs.
 */
export function usePanel(): PanelState {
  const [data, setData] = useState<PanelSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const scan = useScanProgress();
  const { reset } = scan;
  /**
   * Which read is current. A focus refetch and a `scan-done` refetch overlap
   * routinely — the panel is shown while a scan is finishing — and the reads
   * can land in either order. The one started last is the one whose answer is
   * current; every earlier read is retired the moment a newer one begins.
   */
  const ticket = useRef(0);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const mine = ++ticket.current;
    try {
      const res = await commands.getPanelSnapshot();
      if (mine !== ticket.current) return;
      // Never clears `data`: a failed refresh must not blank a panel that is
      // already showing a good answer.
      if (res.status === "ok") setData(res.data);
    } catch {
      // Surfaced by the panel as the unreadable state; nothing to add here.
    } finally {
      // A failed query still ends the load — leaving the skeleton up forever
      // reads as a hang rather than as an error. A superseded read leaves the
      // flag to the read that replaced it.
      if (mine === ticket.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-done", () => {
      setScanning(false);
      void refetch();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  // The panel is not the only place a scan starts — the tray, the scheduler and
  // the Setup screen all fire one. `scan-phase` is the core announcing that a
  // scan is under way whoever asked for it, and a button that stays live through
  // someone else's scan invites a second run on top of it.
  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-phase", () => setScanning(true));
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // The panel is shown with focus and hidden on blur, so a focus gain is the
  // one reliable "the user just opened me" signal there is.
  useEffect(() => {
    if (!isTauri) return;
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) void refetch();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  // No window chrome means no close button: Esc is the keyboard's way out.
  useEffect(() => {
    if (!isTauri) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void getCurrentWindow().hide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const startScan = useCallback(async () => {
    // Clear the previous run's counter first, or the bar flashes it for a frame.
    reset();
    setScanning(true);
    try {
      // The core emits `scan-done` before the command returns, so in practice
      // the event is what ends the scanning state.
      await commands.scanNow();
    } catch {
      // A scan that never started emits nothing at all.
    } finally {
      // Insurance, and the whole story for a failed scan: the command has
      // returned, so nothing is running whether or not the event arrived.
      setScanning(false);
    }
  }, [reset]);

  return { data, loading, scanning, scan, refetch, startScan };
}
