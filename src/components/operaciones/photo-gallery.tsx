"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { type SurveyPhoto } from "@/lib/operaciones/site-survey";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "survey-evidence";

export function PhotoGallery({
  org,
  recordId,
  label,
  value,
  onChange,
  urls,
}: {
  org: string;
  recordId: string;
  label: string;
  value: SurveyPhoto[];
  onChange: (v: SurveyPhoto[]) => void;
  urls: Record<string, string>; // path -> signed URL (existentes)
}) {
  const [uploading, setUploading] = useState(false);
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});

  const displayUrl = (path: string) => localUrls[path] ?? urls[path] ?? "";

  async function onPick(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    const sb = createClient();
    const added: SurveyPhoto[] = [];
    const newUrls: Record<string, string> = {};
    for (const file of Array.from(files)) {
      const ext =
        file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${org}/doc/${recordId}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (up.error) {
        toast.error("No se pudo subir una foto.");
        continue;
      }
      const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
      added.push({ path, caption: "" });
      if (signed?.signedUrl) newUrls[path] = signed.signedUrl;
    }
    setLocalUrls((u) => ({ ...u, ...newUrls }));
    if (added.length) onChange([...value, ...added]);
    setUploading(false);
  }

  function setCaption(i: number, caption: string) {
    onChange(value.map((p, j) => (j === i ? { ...p, caption } : p)));
  }

  async function remove(i: number) {
    const p = value[i];
    onChange(value.filter((_, j) => j !== i));
    if (p?.path) {
      const sb = createClient();
      await sb.storage.from(BUCKET).remove([p.path]);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted">
          <ImagePlus className="size-3.5" />
          {uploading ? "Subiendo…" : "Agregar fotos"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((p, i) => (
            <div key={p.path} className="overflow-hidden rounded-lg border bg-card">
              <div className="aspect-[4/3] w-full bg-muted">
                {displayUrl(p.path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayUrl(p.path)}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                    Foto
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 p-1.5">
                <input
                  className="h-7 w-full rounded border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
                  placeholder="Descripción…"
                  value={p.caption}
                  onChange={(e) => setCaption(i, e.target.value)}
                />
                <button
                  onClick={() => remove(i)}
                  className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-destructive"
                  title="Quitar"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Sin fotos. Toma o sube fotos desde tu celular.
        </div>
      )}
    </div>
  );
}
