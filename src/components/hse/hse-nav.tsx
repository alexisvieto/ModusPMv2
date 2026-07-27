"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  HardHat,
  PackageOpen,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app/hse/permisos", label: "Permisos", icon: ClipboardCheck },
  { href: "/app/hse/inventario", label: "Inventario", icon: HardHat },
  { href: "/app/hse/empleados", label: "Empleados", icon: Users },
  { href: "/app/hse/despacho", label: "Despacho", icon: PackageOpen },
];

// Sub-navegación de Nexus HSE. Mobile-first: barra scrollable con touch targets
// grandes; el activo se resalta con el navy del producto.
export function HseNav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-14 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-2 py-1.5">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
