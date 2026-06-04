import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Apply the standard inner padding. */
  padded?: boolean;
}
