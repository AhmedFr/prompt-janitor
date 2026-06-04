import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "default" | "primary";
export type ButtonSize = "md" | "sm" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}
