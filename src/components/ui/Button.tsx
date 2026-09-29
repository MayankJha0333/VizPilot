"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "soft";
type Size = "xs" | "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "text-white gradient-brand shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,var(--shadow-glow)] hover:brightness-110 hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_14px_34px_-10px_rgba(91,91,214,0.7)]",
  secondary: "bg-ink text-white hover:bg-[#23274a]",
  outline: "bg-surface text-ink border border-border-strong hover:bg-surface-2 hover:border-[#bfc4d8]",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-3 hover:text-ink",
  soft: "bg-brand-soft text-brand-ink hover:bg-[#e2e5fb]",
  danger: "bg-danger text-white hover:bg-red-700",
};

const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-[12px] gap-1 rounded-lg",
  sm: "h-8.5 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background,box-shadow,transform,filter,color,border-color] duration-200 ease-out focus-ring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
