"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Keyboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  INV_STATUS,
  LOCATION_OPTIONS,
  STATUS_OPTIONS,
} from "@/lib/inventory";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Item = Database["public"]["Tables"]["inventory_items"]["Row"];
type LogEntry = { code: string; label: string; ok: boolean };
type Mode = "pistola" | "camara";

export function ScanSheet({
  items,
  open,
  onOpenChange,
  onCreateNew,
}: {
  items: Item[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreateNew: (barcode: string) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pistola");
  const [matched, setMatched] = useState<Item | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const lastScan = useRef<{ code: string; ts: number }>({ code: "", ts: 0 });
  // Cámara: consenso de lecturas (descarta frames mal decodificados) y pausa
  // global tras aceptar un código (deja interactuar sin que el panel cambie).
  const candidate = useRef<{ code: string; hits: number }>({ code: "", hits: 0 });
  const acceptedAt = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  function findItem(code: string): Item | null {
    const c = code.trim().toLowerCase();
    if (!c) return null;
    return (
      itemsRef.current.find((it) =>
        [it.barcode, it.serial_number, it.product_number]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase() === c),
      ) ?? null
    );
  }

  function acceptCode(code: string) {
    lastScan.current = { code, ts: Date.now() };
    const item = findItem(code);
    if (navigator.vibrate) navigator.vibrate(item ? 60 : [40, 60, 40]);
    setFlash(item ? "ok" : "bad");
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 400);
    if (item) {
      setMatched(item);
      setNotFound(null);
      setLog((l) => [{ code, label: item.description, ok: true }, ...l].slice(0, 20));
    } else {
      setMatched(null);
      setNotFound(code);
      setLog((l) => [{ code, label: "No encontrado", ok: false }, ...l].slice(0, 20));
    }
  }

  // Pistola: procesa al Enter; solo se filtra el doble disparo inmediato.
  function handleGunCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    if (lastScan.current.code === code && now - lastScan.current.ts < 1500) return;
    acceptCode(code);
  }

  // Cámara: ZXing dispara ~10 lecturas/segundo y una trama mal decodificada
  // basta para aceptar un código fantasma. Se exige CONSENSO (2 lecturas
  // idénticas seguidas), se pausa todo 2.5 s tras aceptar (para interactuar
  // con el resultado sin que cambie) y el mismo código no se repite en 5 s.
  function handleCameraCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    if (now - acceptedAt.current < 2500) return;
    if (lastScan.current.code === code && now - lastScan.current.ts < 5000) return;
    if (candidate.current.code === code) candidate.current.hits += 1;
    else candidate.current = { code, hits: 1 };
    if (candidate.current.hits < 2) return;
    candidate.current = { code: "", hits: 0 };
    acceptedAt.current = now;
    acceptCode(code);
  }

  // Gun mode: keep input focused
  useEffect(() => {
    if (open && mode === "pistola") {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open, mode]);

  // Camera mode: ZXing live decode (prefers back camera)
  useEffect(() => {
    if (!open || mode !== "camara") return;
    let cancelled = false;
    (async () => {
      setCameraError(null);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
        // Solo los formatos que traen las etiquetas de equipos: menos formatos
        // = menos lecturas falsas y decodificación más rápida. TRY_HARDER
        // mejora la tasa de acierto en 1D a costa de algo de CPU.
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.UPC_A,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          {
            // Resolución alta: con la default (a veces 640×480) los códigos 1D
            // de seriales apenas se resuelven.
            video: {
              facingMode: "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          videoRef.current!,
          (result) => {
            if (result) handleCameraCode(result.getText());
          },
        );
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch {
        setCameraError(
          "No se pudo acceder a la cámara. Revisa permisos y que sea HTTPS o localhost.",
        );
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  async function quickSet(patch: Partial<Pick<Item, "status" | "location">>) {
    if (!matched) return;
    const supabase = createClient();
    await supabase.from("inventory_items").update(patch).eq("id", matched.id);
    setMatched({ ...matched, ...patch });
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Escanear inventario</SheetTitle>
          <SheetDescription>
            Pistola o cámara · busca por código de barras, serial o n° de producto
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            {(
              [
                { v: "pistola", l: "Pistola", icon: Keyboard },
                { v: "camara", l: "Cámara", icon: Camera },
              ] as { v: Mode; l: string; icon: typeof Keyboard }[]
            ).map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.v}
                  onClick={() => setMode(m.v)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    mode === m.v
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {m.l}
                </button>
              );
            })}
          </div>

          {mode === "pistola" ? (
            <div className="space-y-1.5">
              <input
                ref={inputRef}
                autoFocus
                placeholder="Esperando escaneo…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleGunCode((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = "";
                    e.preventDefault();
                  }
                }}
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-center font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              />
              <p className="text-center text-xs text-muted-foreground">
                Dispara la pistola: el código entra y se procesa al instante.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="relative aspect-video overflow-hidden rounded-lg border bg-black">
                <video
                  ref={videoRef}
                  className="size-full object-cover"
                  muted
                  playsInline
                />
                <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-primary/70" />
                {/* Flash de confirmación: verde = encontrado, ámbar = no está */}
                {flash && (
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 transition-opacity",
                      flash === "ok" ? "bg-success/40" : "bg-warning/40",
                    )}
                  />
                )}
              </div>
              {cameraError ? (
                <p className="text-xs text-destructive">{cameraError}</p>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Apunta al código de barras.
                </p>
              )}
            </div>
          )}

          {/* Matched */}
          {matched && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                <Check className="size-3.5" /> Encontrado
              </div>
              <p className="mt-1 text-sm font-medium">{matched.description}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {matched.serial_number || matched.barcode}
              </p>
              <div className="mt-3 space-y-2">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Estado</p>
                  <div className="flex flex-wrap gap-1">
                    {STATUS_OPTIONS.map((o) => (
                      <button
                        key={o.v}
                        onClick={() => quickSet({ status: o.v })}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                          matched.status === o.v
                            ? INV_STATUS[o.v].className
                            : "bg-muted text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Ubicación</p>
                  <div className="flex gap-1">
                    {LOCATION_OPTIONS.map((o) => (
                      <button
                        key={o.v}
                        onClick={() => quickSet({ location: o.v })}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                          matched.location === o.v
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Not found */}
          {notFound && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="text-sm">
                Código{" "}
                <span className="font-mono font-medium">{notFound}</span> no está
                en el inventario.
              </p>
              <Button
                size="sm"
                className="mt-2"
                onClick={() => {
                  onCreateNew(notFound);
                  onOpenChange(false);
                }}
              >
                Crear ítem con este código
              </Button>
            </div>
          )}

          {/* Scan log */}
          {log.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Escaneos ({log.length})
              </p>
              <div className="space-y-0.5">
                {log.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        e.ok ? "bg-success" : "bg-destructive",
                      )}
                    />
                    <span className="font-mono text-muted-foreground">{e.code}</span>
                    <span className="truncate text-muted-foreground">· {e.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
