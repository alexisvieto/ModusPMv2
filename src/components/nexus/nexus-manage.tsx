"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Div = { id: string; name: string };
type Cat = { id: string; name: string; color: string | null; division_id: string };
type Prof = { id: string; name: string; daily_rate: number };
type CatItem = {
  id: string;
  description: string;
  manufacturer: string | null;
  unit_price: number;
  division_id: string | null;
};

const inp =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";

export function NexusManage({
  orgId,
  divisions,
  categories,
  profiles: profilesInit,
  catalog: catalogInit,
  reviewEmail: reviewEmailInit,
}: {
  orgId: string;
  divisions: Div[];
  categories: Cat[];
  profiles: Prof[];
  catalog: CatItem[];
  reviewEmail: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [profiles, setProfiles] = useState<Prof[]>(profilesInit);
  const [catalog, setCatalog] = useState<CatItem[]>(catalogInit);
  const [search, setSearch] = useState("");
  const [reviewEmail, setReviewEmail] = useState(reviewEmailInit);

  // Correo de Teams del aprobador (para "Enviar a revisión"). Guarda al perder foco.
  async function saveReviewEmail() {
    const { error } = await supabase
      .from("nexus_settings")
      .update({ review_teams_email: reviewEmail.trim() || null })
      .eq("organization_id", orgId);
    if (error) return toast.error("No se pudo guardar el correo del aprobador.");
    toast.success("Aprobador guardado.");
  }

  // nuevos
  const [newDiv, setNewDiv] = useState("");
  const [newCat, setNewCat] = useState<Record<string, string>>({});
  const [newProf, setNewProf] = useState({ name: "", rate: "" });

  // ---------- divisiones ----------
  async function addDivision() {
    if (!newDiv.trim()) return;
    const { error } = await supabase.from("nexus_divisions").insert({
      organization_id: orgId,
      name: newDiv.trim(),
      sort_order: divisions.length,
    });
    if (error) return toast.error("No se pudo agregar la división.");
    setNewDiv("");
    router.refresh();
  }

  // ---------- categorías ----------
  async function addCategory(divisionId: string) {
    const name = (newCat[divisionId] ?? "").trim();
    if (!name) return;
    const { error } = await supabase.from("nexus_categories").insert({
      organization_id: orgId,
      division_id: divisionId,
      name,
      sort_order: categories.filter((c) => c.division_id === divisionId).length,
    });
    if (error) return toast.error("No se pudo agregar (¿ya existe?).");
    setNewCat((s) => ({ ...s, [divisionId]: "" }));
    router.refresh();
  }
  async function removeCategory(id: string) {
    const { error } = await supabase.from("nexus_categories").delete().eq("id", id);
    if (error) return toast.error("No se pudo quitar la categoría.");
    router.refresh();
  }

  // ---------- perfiles de mano de obra ----------
  async function addProfile() {
    if (!newProf.name.trim()) return;
    const { data, error } = await supabase
      .from("nexus_labor_profiles")
      .insert({
        organization_id: orgId,
        name: newProf.name.trim(),
        daily_rate: Number(newProf.rate) || 0,
        sort_order: profiles.length,
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return toast.error("No se pudo agregar (¿ya existe?).");
    setProfiles((ps) => [
      ...ps,
      { id: data.id, name: newProf.name.trim(), daily_rate: Number(newProf.rate) || 0 },
    ]);
    setNewProf({ name: "", rate: "" });
  }
  async function saveProfile(p: Prof) {
    const { error } = await supabase
      .from("nexus_labor_profiles")
      .update({ name: p.name.trim(), daily_rate: Number(p.daily_rate) || 0 })
      .eq("id", p.id);
    if (error) toast.error("No se pudo guardar el perfil.");
  }
  async function removeProfile(id: string) {
    const { error } = await supabase.from("nexus_labor_profiles").delete().eq("id", id);
    if (error) return toast.error("No se pudo quitar el perfil.");
    setProfiles((ps) => ps.filter((p) => p.id !== id));
  }

  // ---------- catálogo ----------
  async function saveCatalog(it: CatItem) {
    const { error } = await supabase
      .from("nexus_catalog")
      .update({
        manufacturer: it.manufacturer?.trim() || null,
        unit_price: Number(it.unit_price) || 0,
      })
      .eq("id", it.id);
    if (error) toast.error("No se pudo guardar el ítem.");
  }
  async function removeCatalog(id: string) {
    const { error } = await supabase.from("nexus_catalog").delete().eq("id", id);
    if (error) return toast.error("No se pudo quitar el ítem.");
    setCatalog((cs) => cs.filter((c) => c.id !== id));
  }

  const filteredCatalog = catalog.filter((c) =>
    (c.description + " " + (c.manufacturer ?? ""))
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-10">
      {/* ── Revisión / Aprobación (Teams) ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Revisión / Aprobación</h2>
        <div className="rounded-lg border p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Aprobador — correo de Teams (opcional)
            </span>
            <input
              type="email"
              className={inp + " max-w-md"}
              value={reviewEmail}
              placeholder="gerente@empresa.com"
              onChange={(e) => setReviewEmail(e.target.value)}
              onBlur={saveReviewEmail}
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Al dar <b>Enviar a revisión</b> en una cotización, se descarga el
            Excel y se abre Teams con el mensaje listo. Si pones el correo del
            gerente aquí, abre el chat directo con él; si lo dejas vacío, Teams
            abre un chat nuevo y eliges el destinatario. Luego solo adjuntas el
            Excel y envías.
          </p>
        </div>
      </section>

      {/* ── Divisiones y categorías ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Divisiones y categorías</h2>
        <div className="space-y-4">
          {divisions.map((d) => (
            <div key={d.id} className="rounded-lg border p-4">
              <p className="mb-2 text-sm font-medium">{d.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {categories
                  .filter((c) => c.division_id === d.id)
                  .map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-2 pr-1 text-xs"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: c.color ?? "#94a3b8" }}
                      />
                      {c.name}
                      <button
                        onClick={() => removeCategory(c.id)}
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Quitar"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </span>
                  ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  className={inp + " max-w-xs"}
                  placeholder="Nueva categoría…"
                  value={newCat[d.id] ?? ""}
                  onChange={(e) => setNewCat((s) => ({ ...s, [d.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && addCategory(d.id)}
                />
                <Button size="sm" variant="outline" onClick={() => addCategory(d.id)}>
                  <Plus className="size-4" />
                  Agregar
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              className={inp + " max-w-xs"}
              placeholder="Nueva división…"
              value={newDiv}
              onChange={(e) => setNewDiv(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDivision()}
            />
            <Button size="sm" variant="outline" onClick={addDivision}>
              <Plus className="size-4" />
              División
            </Button>
          </div>
        </div>
      </section>

      {/* ── Perfiles de mano de obra ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Perfiles de mano de obra (tarifa/día)</h2>
        <div className="space-y-2">
          {profiles.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <input
                className={inp + " max-w-xs"}
                value={p.name}
                onChange={(e) =>
                  setProfiles((ps) => ps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                onBlur={() => saveProfile(p)}
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <input
                  type="number"
                  className={inp + " w-28 text-right tabular-nums"}
                  value={p.daily_rate}
                  onChange={(e) =>
                    setProfiles((ps) =>
                      ps.map((x, j) => (j === i ? { ...x, daily_rate: Number(e.target.value) } : x)),
                    )
                  }
                  onBlur={() => saveProfile(p)}
                />
              </div>
              <button
                onClick={() => removeProfile(p.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                title="Quitar perfil"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <input
              className={inp + " max-w-xs"}
              placeholder="Nuevo perfil…"
              value={newProf.name}
              onChange={(e) => setNewProf((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              type="number"
              className={inp + " w-28 text-right tabular-nums"}
              placeholder="$/día"
              value={newProf.rate}
              onChange={(e) => setNewProf((s) => ({ ...s, rate: e.target.value }))}
            />
            <Button size="sm" variant="outline" onClick={addProfile}>
              <Plus className="size-4" />
              Agregar
            </Button>
          </div>
        </div>
      </section>

      {/* ── Catálogo de precios ── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Catálogo de precios{" "}
            <span className="font-normal text-muted-foreground">({catalog.length})</span>
          </h2>
          <input
            className={inp + " max-w-xs"}
            placeholder="Buscar por descripción o fabricante…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filteredCatalog.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {catalog.length === 0
              ? "El catálogo se llena solo: los ítems con precio se aprenden al guardar cada cotización."
              : "Sin coincidencias."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="w-40 px-3 py-2 font-medium">Fabricante</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Precio</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredCatalog.map((it) => {
                  const idx = catalog.findIndex((c) => c.id === it.id);
                  return (
                    <tr key={it.id} className="border-t">
                      <td className="px-3 py-1.5">{it.description}</td>
                      <td className="px-3 py-1.5">
                        <input
                          className={inp}
                          value={it.manufacturer ?? ""}
                          onChange={(e) =>
                            setCatalog((cs) =>
                              cs.map((x, j) =>
                                j === idx ? { ...x, manufacturer: e.target.value } : x,
                              ),
                            )
                          }
                          onBlur={() => saveCatalog(it)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          className={inp + " text-right tabular-nums"}
                          value={it.unit_price}
                          onChange={(e) =>
                            setCatalog((cs) =>
                              cs.map((x, j) =>
                                j === idx ? { ...x, unit_price: Number(e.target.value) } : x,
                              ),
                            )
                          }
                          onBlur={() => saveCatalog(it)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => removeCatalog(it.id)}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          title="Quitar del catálogo"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
