// Stable IPC surface for the frontend. Import from here (not the generated
// bindings) so the rest of the app has one import path.
export { commands } from "./bindings";
export type {
  AppStatus,
  Overview,
  WorklistItem,
  FileRow,
  FileDetail,
  IssueDetail,
  ScansDigest,
  DigestItem,
  RuleInfo,
  AiConfig,
  FixSuggestion,
  FixEdit,
  ApplyResult,
  NlVerdict,
  Entitlement,
  LicenseInfo,
  ScanSummary,
  Severity,
  Source,
  Grade,
  TemplateInfo,
  ApplyTemplateResult,
} from "./bindings";

/** True when running inside the Tauri runtime (vs. a plain browser dev server). */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
