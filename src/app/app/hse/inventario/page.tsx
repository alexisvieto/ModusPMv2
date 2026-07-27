import { EppInventory } from "@/components/hse/epp-inventory";
import { createClient } from "@/lib/supabase/server";

export default async function InventarioPage() {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id ?? null;

  const { data: items } = orgId
    ? await supabase
        .from("hse_epp_items")
        .select(
          "id, nombre, categoria, marca, modelo, descripcion, stock_actual, stock_minimo, vida_util_dias, imagen_path",
        )
        .eq("organization_id", orgId)
        .eq("activo", true)
        .order("nombre", { ascending: true })
    : { data: [] };

  if (!orgId) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-sm text-muted-foreground">
        Sin organización.
      </div>
    );
  }

  // Firma las imágenes en una sola llamada.
  const paths = (items ?? []).map((it) => it.imagen_path).filter((p): p is string => !!p);
  const urlByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from("hse-evidence")
      .createSignedUrls(paths, 3600);
    (signed ?? []).forEach((s, i) => {
      if (s.signedUrl) urlByPath.set(paths[i], s.signedUrl);
    });
  }

  return (
    <EppInventory
      orgId={orgId}
      initial={(items ?? []).map((it) => ({
        id: it.id,
        nombre: it.nombre,
        categoria: it.categoria ?? "",
        marca: it.marca ?? "",
        modelo: it.modelo ?? "",
        descripcion: it.descripcion ?? "",
        stock_actual: String(it.stock_actual ?? 0),
        stock_minimo: String(it.stock_minimo ?? 0),
        vida_util_dias: it.vida_util_dias == null ? "" : String(it.vida_util_dias),
        imagen_path: it.imagen_path ?? "",
        imagen_url: it.imagen_path ? (urlByPath.get(it.imagen_path) ?? "") : "",
      }))}
    />
  );
}
