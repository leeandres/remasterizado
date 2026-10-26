"use client";

import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ToastHost() {
  const toast = useStudio((state) => state.toast);
  const dismiss = useStudio((state) => state.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(dismiss, toast.tone === "error" ? 7000 : 4500);
    return () => window.clearTimeout(timeout);
  }, [toast, dismiss]);

  if (!toast) return null;

  const Icon =
    toast.tone === "error" ? AlertTriangle : toast.tone === "success" ? CheckCircle2 : Info;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4 sm:bottom-8">
      <div
        className={cn(
          "animate-fade-up pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border bg-[#11141b]/95 px-4 py-3 shadow-2xl backdrop-blur-xl",
          toast.tone === "error"
            ? "border-danger/30"
            : toast.tone === "success"
              ? "border-lime-acid/30"
              : "border-white/12",
        )}
      >
        <Icon
          size={16}
          className={cn(
            "mt-0.5 shrink-0",
            toast.tone === "error"
              ? "text-danger"
              : toast.tone === "success"
                ? "text-lime-acid"
                : "text-cyan-glow",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-white">{toast.title}</p>
          {toast.message && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-400">{toast.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="focus-ring mt-0.5 text-ink-400 transition hover:text-white"
          aria-label="Cerrar aviso"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
