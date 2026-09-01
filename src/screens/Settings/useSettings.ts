import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type AppStatus, type AiConfig, type Entitlement } from "@/lib/ipc";

/**
 * Loads the persisted settings and exposes setters that persist immediately.
 *
 * Refetches on `scan-done` like every other screen: the About panel's counts
 * come straight from the database, and a scan — or a reset from the App tab —
 * rewrites it underneath a Settings screen that happens to still be open.
 */
export function useSettings() {
  const [schedule, setScheduleState] = useState("6h");
  const [digest, setDigestState] = useState(true);
  const [regressions, setRegressionsState] = useState(true);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [ai, setAi] = useState<AiConfig | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const [s, d, r, st, a, e] = await Promise.all([
      commands.getSchedule(),
      commands.getAlert("digest"),
      commands.getAlert("regressions"),
      commands.getAppStatus(),
      commands.getAiConfig(),
      commands.getEntitlement(),
    ]);
    if (s.status === "ok") setScheduleState(s.data);
    if (d.status === "ok") setDigestState(d.data);
    if (r.status === "ok") setRegressionsState(r.data);
    if (st.status === "ok") setStatus(st.data);
    if (a.status === "ok") setAi(a.data);
    if (e.status === "ok") setEntitlement(e.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-done", () => void load());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [load]);

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

  const activateLicense = useCallback(async (key: string): Promise<string> => {
    const res = await commands.setLicense(key);
    if (res.status !== "ok") return res.error;
    const e = await commands.getEntitlement();
    if (e.status === "ok") setEntitlement(e.data);
    return `Activated — ${res.data.plan} plan`;
  }, []);

  const removeLicense = useCallback(async () => {
    await commands.clearLicense();
    const e = await commands.getEntitlement();
    if (e.status === "ok") setEntitlement(e.data);
  }, []);

  return {
    schedule,
    digest,
    regressions,
    status,
    ai,
    entitlement,
    loading,
    setSchedule,
    setDigest,
    setRegressions,
    saveAi,
    testAi,
    activateLicense,
    removeLicense,
  };
}
