"use client";

import { LayoutDashboard, Library, SlidersHorizontal } from "lucide-react";
import { useStudio } from "@/lib/store";
import type { MobileView } from "@/lib/types";
import { cn } from "@/lib/utils";

const ITEMS: Array<{ id: MobileView; label: string; icon: typeof Library }> = [
  { id: "studio", label: "Estudio", icon: LayoutDashboard },
  { id: "rack", label: "Cadena", icon: SlidersHorizontal },
  { id: "library", label: "Perfil", icon: Library },
];

export function MobileNav() {
  const view = useStudio((state) => state.mobileView);
  const setView = useStudio((state) => state.setMobileView);
  const track = useStudio((state) => state.track);
  const bypass = useStudio((state) => state.bypass);

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="grid grid-cols-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "focus-ring relative flex flex-col items-center gap-1 py-2.5 text-[8.5px] font-medium transition",
                active ? "text-lime-acid" : "text-ink-500",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-lime-acid to-transparent" />
              )}
              <span className="relative">
                <Icon size={17} strokeWidth={active ? 2.3 : 1.7} />
                {item.id === "studio" && track && (
                  <span
                    className={cn(
                      "absolute -right-1.5 -top-0.5 h-1.5 w-1.5 rounded-full border border-[#090b10]",
                      bypass ? "bg-amber-glow" : "bg-lime-acid",
                    )}
                  />
                )}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
