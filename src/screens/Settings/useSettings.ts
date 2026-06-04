import { useCallback, useEffect, useState } from "react";
import { commands, isTauri, type AppStatus, type AiConfig } from "@/lib/ipc";

/** Loads the persisted settings and exposes setters that persist immediately. */
export function useSettings() {
  const [schedule, setScheduleState] = useState("6h");
  const [digest, setDigestState] = useState(true);
  const [regressions, setRegressionsState] = useState(true);
  const [folder, setFolder] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [ai, setAi] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isTauri) {
        setLoading(false);
        return;
      }
      const [s, d, r, f, st, a] = await Promise.all([
        commands.getSchedule(),
        commands.getAlert("digest"),
        commands.getAlert("regressions"),
        commands.getScanFolder(),
        commands.getAppStatus(),
        commands.getAiConfig(),
      ]);
      if (!active) return;
      if (s.status === "ok") setScheduleState(s.data);
      if (d.status === "ok") setDigestState(d.data);
      if (r.status === "ok") setRegressionsState(r.data);
      if (f.status === "ok") setFolder(f.data);
      if (st.status === "ok") setStatus(st.data);
      if (a.status === "ok") setAi(a.data);
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

  const saveAi = useCallback(async (provider: string, apiKey: string, model: string) => {
    await commands.setAiConfig(provider, apiKey, model);
    const res = await commands.getAiConfig();
    if (res.status === "ok") setAi(res.data);
  }, []);

  const testAi = useCallback(async (): Promise<string> => {
    const res = await commands.testAiConnection();
    return res.status === "ok" ? res.data : res.error;
  }, []);

  return {
    schedule,
    digest,
    regressions,
    folder,
    status,
    ai,
    loading,
    setSchedule,
    setDigest,
    setRegressions,
    setFolder,
    saveAi,
    testAi,
  };
}
