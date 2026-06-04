import type { ButtonProps } from "./Button.types";
import "./Button.css";

/** Pill button matching the macOS control style. */
export function Button({ variant = "default", size = "md", className, children, ...rest }: ButtonProps) {
  const classes = [
    "btn",
    variant === "primary" ? "btn--primary" : "",
    size === "sm" ? "btn--sm" : "",
    size === "icon" ? "btn--icon" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
