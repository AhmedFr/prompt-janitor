import type { HeadingProps } from "./KindSections.types";

/** A heading at the depth its surrounding section sits at, so no level is skipped. */
export function Heading({ level, children }: HeadingProps) {
  const className = "setup-kind__title";
  return level === 3 ? (
    <h3 className={className}>{children}</h3>
  ) : (
    <h4 className={className}>{children}</h4>
  );
}
