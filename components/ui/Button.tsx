import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-lime-acid text-[#0a0c04] hover:bg-[#e3ff7d] shadow-[0_0_24px_-6px_rgba(216,255,87,0.55)] border border-lime-acid/60",
  secondary:
    "bg-white/[0.06] text-ink-100 hover:bg-white/[0.1] border border-white/10",
  ghost: "text-ink-300 hover:text-ink-100 hover:bg-white/[0.055] border border-transparent",
  danger:
    "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/25",
  outline:
    "border border-white/12 text-ink-200 hover:border-white/25 hover:text-white bg-transparent",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[11px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-[12px] gap-2 rounded-xl",
  lg: "h-12 px-5 text-[13px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg justify-center",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center font-semibold tracking-tight transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
