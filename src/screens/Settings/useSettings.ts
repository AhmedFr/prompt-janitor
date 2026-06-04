import { useCallback, useEffect, useState } from "react";
import { commands, isTauri, type AppStatus } from "@/lib/ipc";

/** Loads the persisted settings and exposes setters that persist immediately. */
export function useSettings() {
  const [schedule, setScheduleState] = useState("6h");
  const [digest, setDigestState] = useState(true);
  const [regressions, setRegressionsState] = useState(true);
  const [folder, setFolder] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isTauri) {
        setLoading(false);
        return;
      }
      const [s, d, r, f, st] = await Promise.all([
        commands.getSchedule(),
        commands.getAlert("digest"),
        commands.getAlert("regressions"),
        commands.getScanFolder(),
        commands.getAppStatus(),
      ]);
      if (!active) return;
      if (s.status === "ok") setScheduleState(s.data);
      if (d.status === "ok") setDigestState(d.data);
      if (r.status === "ok") setRegressionsState(r.data);
      if (f.status === "ok") setFolder(f.data);
      if (st.status === "ok") setStatus(st.data);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const setSchedule = useCallback(async (v: string) => {
    setScheduleState(v);
    await commands.setSchedule(v);
  }, []);
  const setDigest = useCallback(async (v: boolean) => {
    setDigestState(v);
    await commands.setAlert("digest", v);
  }, []);
  const setRegressions = useCallback(async (v: boolean) => {
    setRegressionsState(v);
    await commands.setAlert("regressions", v);
  }, []);

  return {
    schedule,
    digest,
    regressions,
    folder,
    status,
    loading,
    setSchedule,
    setDigest,
    setRegressions,
    setFolder,
  };
}
