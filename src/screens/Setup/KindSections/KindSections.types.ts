import type { ReactNode } from "react";
import type { ArtifactView } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";
import type { SetupFilter } from "../setup.util";

/** Heading depth for a block nested under the Global/Projects `h2`. */
export type Level = 3 | 4;

export interface HeadingProps {
  level: Level;
  children: ReactNode;
}

export interface KindSectionsProps {
  artifacts: ArtifactView[];
  filter: SetupFilter;
  /** The whole setup's cost bar, so "High cost" means the same in every block. */
  costBar: number | null;
  level: Level;
  navigate: Navigate;
}
