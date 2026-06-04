import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";
import type { Navigate } from "@/App/App.types";

export interface PromptsProps {
  navigate: Navigate;
}

export function Prompts(_props: PromptsProps) {
  return <ScreenPlaceholder title="Prompts" subtitle="The graded file table lands in #11." />;
}
