"use client";

import { Plus, Trash2 } from "lucide-react";

// Piezas compartidas por los formularios de formatos ISO (Comercial).
export const inp =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";
export const lbl = "text-xs font-medium text-muted-foreground";

export function Section({
  title,
  children,
  onAdd,
  addLabel,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#0f2044]">{title}</h2>
        {onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-3.5" /> {addLabel ?? "Agregar"}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={lbl}>{label}</span>
      {children}
    </label>
  );
}

export function RowDelete({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
      title="Quitar"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
