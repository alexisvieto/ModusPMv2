"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type CatalogRow = {
  description: string;
  manufacturer: string | null;
  unit_price: number;
};

// Autocompletar del catálogo. Busca por descripción o fabricante/código y
// muestra el precio en cada sugerencia. El dropdown se renderiza con portal +
// posición fija para NO quedar recortado por el overflow de la tabla de ítems.
export function CatalogCombobox({
  value,
  onChange,
  onPick,
  catalog,
  className,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (row: CatalogRow) => void;
  catalog: CatalogRow[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const q = value.trim().toLowerCase();
  const matches: CatalogRow[] = [];
  if (q.length >= 2) {
    for (const c of catalog) {
      if (
        c.description.toLowerCase().includes(q) ||
        (c.manufacturer ?? "").toLowerCase().includes(q)
      ) {
        matches.push(c);
        if (matches.length >= 8) break;
      }
    }
  }
  const show = open && matches.length > 0;

  // Reposiciona/cierra al hacer scroll o resize mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const sync = () => {
      if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    };
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [open]);

  function openList() {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    setOpen(true);
  }

  function pick(row: CatalogRow) {
    onPick(row);
    setOpen(false);
  }

  return (
    <>
      <input
        ref={inputRef}
        className={className}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setHi(0);
          openList();
        }}
        onFocus={openList}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(matches[hi]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {show &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            className="z-50 max-h-64 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
            style={{
              position: "fixed",
              left: rect.left,
              top: rect.bottom + 4,
              width: Math.max(rect.width, 340),
            }}
          >
            {matches.map((m, i) => (
              <li key={m.description + i}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm",
                    i === hi ? "bg-muted" : "hover:bg-muted",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(m);
                  }}
                  onMouseEnter={() => setHi(i)}
                >
                  <span className="min-w-0 truncate">
                    {m.description}
                    {m.manufacturer ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {m.manufacturer}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                    {m.unit_price.toLocaleString("es-PA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
