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

// Clay buttons: puffy, hue-tinted shadows, and they sink a little when pressed.
const variants: Record<Variant, string> = {
  primary: "clay-brand hover:brightness-[1.06]",
  secondary: "bg-inverse text-inverse-fg shadow-[var(--shadow-sm)] hover:opacity-90",
  outline: "bg-surface text-ink shadow-[var(--shadow-sm)] hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-3 hover:text-ink",
  soft: "bg-brand-soft text-brand-ink shadow-[var(--shadow-sm)] hover:brightness-[0.97]",
  danger: "bg-danger text-white shadow-[0_8px_18px_-8px_rgba(225,29,72,0.6),inset_0_-3px_6px_rgba(120,0,30,0.35),inset_0_3px_5px_rgba(255,255,255,0.3)] hover:brightness-110",
};

const sizes: Record<Size, string> = {
  xs: "h-7 px-3 text-[12px] gap-1 rounded-full",
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-full",
  md: "h-11 px-5 text-sm gap-2 rounded-[16px]",
  lg: "h-13 px-7 text-[15px] gap-2 rounded-[18px]",
  icon: "h-10 w-10 rounded-[14px]",
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
        "inline-flex select-none items-center justify-center whitespace-nowrap font-bold transition-[background,box-shadow,transform,filter,color,opacity] duration-150 ease-out focus-ring active:translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0 disabled:active:scale-100",
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
