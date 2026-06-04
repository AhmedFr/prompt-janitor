import type { CardProps } from "./Card.types";
import "./Card.css";

/** Surface container with the standard border, radius, and soft shadow. */
export function Card({ padded = false, className, children, ...rest }: CardProps) {
  const classes = ["card", padded ? "card--pad" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
