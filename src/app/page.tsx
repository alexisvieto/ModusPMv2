import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MODULES = [
  "Inventario",
  "Gantt",
  "Curva S",
  "Reportes diarios",
  "FAT / SAT",
  "Punch list",
  "Adicionales",
  "Costos",
  "IA",
];

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Wordmark />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <span className="cursor-default transition-colors hover:text-foreground">
              Módulos
            </span>
            <span className="cursor-default transition-colors hover:text-foreground">
              Curva S
            </span>
            <span className="cursor-default transition-colors hover:text-foreground">
              IA
            </span>
          </nav>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          Demo en construcción · 15 jun
        </span>

        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Tus proyectos de ingeniería,
          <br className="hidden sm:block" />
          <span className="text-primary"> bajo control y en calma.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
          Inventario, Gantt, curva S, reportes diarios y FAT/SAT en un solo
          lugar. Colaborativo, en tiempo real y con IA — para que el PM decida,
          no persiga datos.
        </p>

        <div className="mt-9 flex items-center gap-3">
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "lg" }), "h-10 px-5")}
          >
            Entrar
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "h-10 px-4",
            )}
          >
            Ver módulos
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs">
          <StatusChip label="En curso" className="bg-success/10 text-success" />
          <StatusChip label="En riesgo" className="bg-warning/10 text-warning" />
          <StatusChip
            label="Retrasado"
            className="bg-destructive/10 text-destructive"
          />
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-5 text-xs text-muted-foreground">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {MODULES.map((m, i) => (
                <span key={m} className="flex items-center gap-2">
                  {i > 0 && <span className="text-border">·</span>}
                  <span>{m}</span>
                </span>
              ))}
            </div>
            <span className="font-mono whitespace-nowrap">v0.1 · demo</span>
          </div>
          <div className="border-t pt-3 text-center text-muted-foreground">
            Modus PM — un producto de{" "}
            <span className="font-medium text-foreground">Nexera</span>
            {" · "}
            <a
              href="https://www.nexera.io"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground hover:underline"
            >
              www.nexera.io
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
        <span className="font-mono text-sm font-bold">M</span>
      </div>
      <span className="text-base font-semibold tracking-tight">
        Modus
        <span className="ml-1 font-mono font-medium text-primary">PM</span>
      </span>
    </div>
  );
}

function StatusChip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${className ?? ""}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
