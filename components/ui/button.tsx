import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "neutral" | "secondary" | "danger";
export type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  neutral: "bg-[var(--ui-ink)] text-[var(--ui-surface)] hover:opacity-85",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  danger: "border border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return [
    "inline-flex shrink-0 items-center justify-center rounded-md font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClassName({ variant, size, className })} {...props} />;
}
