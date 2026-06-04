import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";
import type { Navigate } from "@/App/App.types";

export interface DetailProps {
  fileId: string | null;
  navigate: Navigate;
}

export function Detail(_props: DetailProps) {
  return <ScreenPlaceholder title="Prompt detail" subtitle="Annotated source + scorecard land in #12." />;
}
