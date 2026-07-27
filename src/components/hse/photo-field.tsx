"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

// Picker de una sola imagen (foto de empleado / EPP). Presentacional: el padre
// maneja el File pendiente y la URL a mostrar.
export function PhotoField({
  url,
  onPick,
  onClear,
  shape = "square",
}: {
  url: string;
  onPick: (file: File) => void;
  onClear: () => void;
  shape?: "circle" | "square";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const rounded = shape === "circle" ? "rounded-full" : "rounded-lg";

  return (
    <div className="flex items-center gap-3">
      {url ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className={`size-20 border object-cover ${rounded}`} />
          <button
            type="button"
            onClick={onClear}
            className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={`flex size-20 items-center justify-center border border-dashed text-muted-foreground transition-colors hover:border-[#0f2044]/40 hover:text-foreground ${rounded}`}
        >
          <ImagePlus className="size-6" />
        </button>
      )}
      {url && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cambiar
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (ref.current) ref.current.value = "";
        }}
      />
    </div>
  );
}
