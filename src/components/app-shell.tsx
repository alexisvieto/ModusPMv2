"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Calculator,
  CalendarRange,
  Check,
  ChevronsUpDown,
  ClipboardList,
  FlaskConical,
  FolderKanban,
  Info,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  ListTodo,
  LogOut,
  Menu,
  Package,
  Receipt,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { PunchAlerts } from "@/components/punch/punch-alerts";
import { AboutDialog } from "@/components/about-dialog";
import type { Brand } from "@/lib/brand";

type ShellProject = {
  id: string;
  name: string;
  code: string | null;
  client_name: string | null;
  status: string;
};

function initialsOf(name: string | null, email: string | null) {
  const base = name?.trim() || email || "U";
  return base
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function AppShell({
  children,
  projects,
  org,
  profile,
  userEmail,
  brand,
  isPlatformAdmin = false,
}: {
  children: React.ReactNode;
  projects: ShellProject[];
  org: { id: string; name: string; slug: string } | null;
  profile: { full_name: string | null; title: string | null } | null;
  userEmail: string | null;
  brand: Brand;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const activeProjectId =
    pathname.match(/\/app\/proyectos\/([^/]+)/)?.[1] ?? null;
  const activeProject =
    projects.find((p) => p.id === activeProjectId) ?? null;

  const nav = activeProjectId
    ? [
        {
          label: "Dashboard",
          href: `/app/proyectos/${activeProjectId}`,
          icon: LayoutDashboard,
          exact: true,
        },
        {
          label: "Cronograma",
          href: `/app/proyectos/${activeProjectId}/cronograma`,
          icon: CalendarRange,
        },
        {
          label: "Inventario",
          href: `/app/proyectos/${activeProjectId}/inventario`,
          icon: Package,
        },
        {
          label: "Reportes diarios",
          href: `/app/proyectos/${activeProjectId}/reportes`,
          icon: ClipboardList,
        },
        {
          label: "Pruebas",
          href: `/app/proyectos/${activeProjectId}/fat-sat`,
          icon: FlaskConical,
        },
        {
          label: "Pendientes",
          href: `/app/proyectos/${activeProjectId}/pendientes`,
          icon: ListTodo,
        },
        {
          label: "Costos",
          href: `/app/proyectos/${activeProjectId}/costos`,
          icon: Receipt,
        },
        {
          label: "Cálculo",
          href: `/app/proyectos/${activeProjectId}/calculo`,
          icon: Calculator,
        },
        {
          label: "IA",
          href: `/app/proyectos/${activeProjectId}/ia`,
          icon: Sparkles,
        },
      ]
    : [];

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Cierre limpio: recarga dura al landing público de Modus PM (limpia la caché del router).
    window.location.href = "/";
  }

  const initials = initialsOf(profile?.full_name ?? null, userEmail);
  // White-label por tenant: tiñe los tokens de marca con el color de la org.
  const brandColor = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
    brand.primary,
  )
    ? brand.primary
    : null;

  // Contenido del sidebar, reutilizado en el aside de escritorio y en el panel
  // deslizante de móvil. `onNavigate` cierra el panel al tocar un enlace.
  const sidebarInner = (onNavigate?: () => void) => (
    <>
      <div className="flex h-16 items-center gap-2 border-b px-5">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="h-7 w-auto max-w-[190px] object-contain"
          />
        ) : (
          <>
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <span className="font-mono text-sm font-bold">M</span>
            </div>
            <span className="text-base font-semibold tracking-tight">
              Modus
              <span className="ml-1 font-mono font-medium text-primary">PM</span>
            </span>
          </>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        <Link
          href="/app"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            pathname === "/app"
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-4" />
          Proyectos
        </Link>

        {activeProjectId && (
          <>
            <p className="truncate px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
              {activeProject?.name ?? "Proyecto"}
            </p>
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{org?.name ?? "Sin organización"}</span>
        </div>
        <button
          onClick={() => {
            onNavigate?.();
            signOut();
          }}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <TooltipProvider delay={200}>
      {brandColor && (
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--primary:${brandColor};--sidebar-primary:${brandColor};--ring:${brandColor};--sidebar-ring:${brandColor};}`,
          }}
        />
      )}
      <div className="flex min-h-svh">
        {/* ===== Sidebar (escritorio) ===== */}
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
          {sidebarInner()}
        </aside>

        {/* ===== Navegación móvil (panel deslizante) ===== */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="gap-0 border-r bg-sidebar p-0"
          >
            <SheetTitle className="sr-only">Navegación</SheetTitle>
            <div className="flex h-full flex-col">
              {sidebarInner(() => setMobileOpen(false))}
            </div>
          </SheetContent>
        </Sheet>

        {/* ===== Main column ===== */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
            {/* Left: hamburguesa (móvil) + project switcher */}
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menú"
                className="-ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
              >
                <Menu className="size-5" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex min-w-0 max-w-[60vw] items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted">
                  <FolderKanban className="size-4 shrink-0 text-primary" />
                  <span className="truncate font-medium">
                    {activeProject?.name ?? "Selecciona un proyecto"}
                  </span>
                  {activeProject?.code && (
                    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                      {activeProject.code}
                    </span>
                  )}
                  <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                    Proyectos
                  </div>
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => router.push(`/app/proyectos/${p.id}`)}
                    >
                      <FolderKanban className="size-4 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{p.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {p.client_name ?? p.code ?? ""}
                        </span>
                      </div>
                      {p.id === activeProjectId && (
                        <Check className="ml-auto size-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right cluster: presence + user */}
            <div className="flex items-center gap-3">
              <Link
                href="/app/ayuda"
                title="Centro de ayuda"
                aria-label="Ayuda"
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border transition-colors hover:bg-muted",
                  pathname.startsWith("/app/ayuda")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground",
                )}
              >
                <LifeBuoy className="size-4.5" />
              </Link>
              <PunchAlerts projectId={activeProjectId} />
              <div className="hidden items-center gap-2 rounded-full border bg-card px-2.5 py-1 sm:flex">
                <Avatar size="sm">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                  <AvatarBadge className="bg-success" />
                </Avatar>
                <span className="text-xs text-muted-foreground">En línea</span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full outline-none">
                  <Avatar size="default">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-medium">
                      {profile?.full_name ?? "Usuario"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </p>
                    {profile?.title && (
                      <p className="mt-0.5 truncate text-xs text-primary">
                        {profile.title}
                      </p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  {isPlatformAdmin && (
                    <DropdownMenuItem onClick={() => router.push("/admin")}>
                      <ShieldCheck className="size-4" />
                      Plataforma (empresas y usuarios)
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setAboutOpen(true)}>
                    <Info className="size-4" />
                    Acerca de Modus PM
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={signOut}>
                    <LogOut className="size-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="min-w-0 flex-1 bg-muted/20">{children}</main>
        </div>

        <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
        <Toaster position="top-right" />
      </div>
    </TooltipProvider>
  );
}
