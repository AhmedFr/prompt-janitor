import type { AiConfig } from "@/lib/ipc";

export interface AiTabProps {
  /** The persisted AI config (no key), or null while loading. */
  ai: AiConfig | null;
  /** Persist provider + key + model. An empty key keeps the stored one. */
  onSave: (provider: string, apiKey: string, model: string) => Promise<void>;
  /** Verify the saved provider/key with a tiny request; resolves to a message. */
  onTest: () => Promise<string>;
}
