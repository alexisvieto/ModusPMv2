"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ExternalLink, X } from "lucide-react";

const APP_VERSION = "1.0";
const TEAL = "#0F766E"; // marca del producto (Modus PM), fija aquí aunque el tenant tiña la app

export function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <Dialog.Close
            aria-label="Cerrar"
            className="absolute right-3.5 top-3.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </Dialog.Close>

          {/* Producto */}
          <Dialog.Title className="text-lg font-semibold tracking-tight">
            Modus
            <span className="ml-1 font-mono font-medium" style={{ color: TEAL }}>
              PM
            </span>
          </Dialog.Title>
          <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
            Gestión de proyectos de ingeniería
          </Dialog.Description>
          <p className="mt-1 text-xs text-muted-foreground">
            Versión {APP_VERSION}
          </p>

          {/* Desarrollado por — panel oscuro para que el logo metálico resalte */}
          <div className="mt-5 rounded-lg bg-[#111827] px-6 py-5">
            <p className="text-center text-[10px] font-medium uppercase tracking-widest text-white/50">
              Desarrollado por
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/nexera-logo.png"
              alt="Nexera"
              className="mx-auto mt-2 h-9 w-auto"
            />
            <p className="mt-2.5 text-center text-[11px] tracking-wide text-white/60">
              AI · Automate · Accelerate
            </p>
          </div>

          {/* Enlaces */}
          <div className="mt-4 space-y-2 text-sm">
            <a
              href="https://www.nexera.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium hover:underline"
              style={{ color: TEAL }}
            >
              www.nexera.io
              <ExternalLink className="size-3.5" />
            </a>
            <p className="text-muted-foreground">
              Modus PM es parte de la suite de Nexera.
            </p>
            <p className="text-muted-foreground">
              ¿Necesitas ayuda?{" "}
              <a
                href="mailto:soporte@nexera.io"
                className="font-medium hover:underline"
                style={{ color: TEAL }}
              >
                soporte@nexera.io
              </a>
            </p>
          </div>

          <div className="my-4 h-px bg-border" />
          <p className="text-xs text-muted-foreground">
            © 2026 Nexera. Todos los derechos reservados.
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
