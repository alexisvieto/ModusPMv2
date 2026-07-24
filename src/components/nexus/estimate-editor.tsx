"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Save, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { sendToOdoo } from "@/app/app/nexus/odoo-actions";

import { Button } from "@/components/ui/button";
import {
  addBuckets,
  bucketsFrom,
  calcCascade,
  margin,
  type CostKind,
  type NexusParams,
} from "@/lib/nexus/calc";
import { exportEstimateExcel } from "@/lib/nexus/excel";
import { createClient } from "@/lib/supabase/client";

// ---------- tipos del editor (numéricos como string para edición fluida) ----------
type EItem = {
  uid: string;
  description: string;
  manufacturer: string;
  kind: CostKind;
  qty: string;
  unit_price: string;
  unit: string;
};
type ELabor = {
  uid: string;
  profile_id: string | null;
  profile_name: string;
  daily_rate: number;
  personas: string;
  dias: string;
};
type ECat = {
  uid: string;
  category_id: string | null;
  name: string;
  color: string | null;
  items: EItem[];
  labor: ELabor[];
};

type EstimateProps = {
  id: string;
  name: string;
  client_name: string;
  odoo_code: string;
  elaborated_by: string;
  estimate_date: string;
  division_id: string | null;
  params: NexusParams;
};

const KINDS: { v: CostKind; l: string }[] = [
  { v: "Material", l: "Material" },
  { v: "ManoDeObra", l: "Mano de Obra" },
  { v: "Herramienta", l: "Herramienta" },
  { v: "Flete", l: "Flete" },
];

const money = (n: number) =>
  n.toLocaleString("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uid = () => crypto.randomUUID();

const inp =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30";
const inpR = inp + " text-right tabular-nums";

export function EstimateEditor({
  estimate,
  initialCategories,
  orgCategories,
  laborProfiles,
  divisions,
}: {
  estimate: EstimateProps;
  initialCategories: ECat[];
  orgCategories: { id: string; name: string; color: string | null; division_id: string }[];
  laborProfiles: { id: string; name: string; daily_rate: number }[];
  divisions: { id: string; name: string }[];
}) {
  const router = useRouter();

  const [name, setName] = useState(estimate.name);
  const [client, setClient] = useState(estimate.client_name);
  const [odooCode, setOdooCode] = useState(estimate.odoo_code);
  const [elaboratedBy, setElaboratedBy] = useState(estimate.elaborated_by);
  const [date, setDate] = useState(estimate.estimate_date);
  const [divisionId, setDivisionId] = useState<string | null>(estimate.division_id);
  const [cats, setCats] = useState<ECat[]>(initialCategories);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [pickCat, setPickCat] = useState("");

  // % en porcentaje (string) para edición cómoda; se convierten a fracción.
  // toFixed(6) limpia el ruido de punto flotante (0.07×100 = 7.000000000000001).
  const pctStr = (f: number) => String(+(f * 100).toFixed(6));
  const [pct, setPct] = useState({
    ind_oficina: pctStr(estimate.params.ind_oficina),
    ind_campo: pctStr(estimate.params.ind_campo),
    financiamiento: pctStr(estimate.params.financiamiento),
    utilidad: pctStr(estimate.params.utilidad),
    itbms: pctStr(estimate.params.itbms),
  });
  const paramsFrac: NexusParams = {
    ind_oficina: (Number(pct.ind_oficina) || 0) / 100,
    ind_campo: (Number(pct.ind_campo) || 0) / 100,
    financiamiento: (Number(pct.financiamiento) || 0) / 100,
    utilidad: (Number(pct.utilidad) || 0) / 100,
    itbms: (Number(pct.itbms) || 0) / 100,
  };

  // ---------- cálculo en vivo (cascada) ----------
  const catBuckets = cats.map((c) =>
    bucketsFrom(
      c.items.map((it) => ({
        kind: it.kind,
        qty: Number(it.qty) || 0,
        unit_price: Number(it.unit_price) || 0,
      })),
      c.labor.map((l) => ({
        personas: Number(l.personas) || 0,
        dias: Number(l.dias) || 0,
        daily_rate: l.daily_rate,
      })),
    ),
  );
  const grandBuckets = catBuckets.reduce(addBuckets, {
    material: 0,
    manoObra: 0,
    herramienta: 0,
    flete: 0,
  });
  const grand = calcCascade(grandBuckets, paramsFrac);

  // ---------- updaters inmutables ----------
  const patchCat = (cu: string, patch: Partial<ECat>) =>
    setCats((cs) => cs.map((c) => (c.uid === cu ? { ...c, ...patch } : c)));
  const patchItem = (cu: string, iu: string, patch: Partial<EItem>) =>
    setCats((cs) =>
      cs.map((c) =>
        c.uid === cu
          ? { ...c, items: c.items.map((i) => (i.uid === iu ? { ...i, ...patch } : i)) }
          : c,
      ),
    );
  const patchLabor = (cu: string, lu: string, patch: Partial<ELabor>) =>
    setCats((cs) =>
      cs.map((c) =>
        c.uid === cu
          ? { ...c, labor: c.labor.map((l) => (l.uid === lu ? { ...l, ...patch } : l)) }
          : c,
      ),
    );

  function addCategory() {
    const oc = orgCategories.find((c) => c.id === pickCat);
    if (!oc) {
      toast.error("Elegí una categoría.");
      return;
    }
    setCats((cs) => [
      ...cs,
      { uid: uid(), category_id: oc.id, name: oc.name, color: oc.color, items: [], labor: [] },
    ]);
    setPickCat("");
  }
  const removeCategory = (cu: string) =>
    setCats((cs) => cs.filter((c) => c.uid !== cu));
  const addItem = (cu: string) =>
    patchCat(cu, {
      items: [
        ...(cats.find((c) => c.uid === cu)?.items ?? []),
        { uid: uid(), description: "", manufacturer: "", kind: "Material", qty: "1", unit_price: "0", unit: "und" },
      ],
    });
  const removeItem = (cu: string, iu: string) =>
    setCats((cs) =>
      cs.map((c) => (c.uid === cu ? { ...c, items: c.items.filter((i) => i.uid !== iu) } : c)),
    );
  function addLabor(cu: string) {
    const p = laborProfiles[0];
    patchCat(cu, {
      labor: [
        ...(cats.find((c) => c.uid === cu)?.labor ?? []),
        {
          uid: uid(),
          profile_id: p?.id ?? null,
          profile_name: p?.name ?? "Mano de obra",
          daily_rate: p?.daily_rate ?? 0,
          personas: "1",
          dias: "1",
        },
      ],
    });
  }
  const removeLabor = (cu: string, lu: string) =>
    setCats((cs) =>
      cs.map((c) => (c.uid === cu ? { ...c, labor: c.labor.filter((l) => l.uid !== lu) } : c)),
    );

  // categorías de la org disponibles para la división elegida
  const availCats = orgCategories.filter(
    (c) => !divisionId || c.division_id === divisionId,
  );

  async function persist(): Promise<boolean> {
    const supabase = createClient();
    const header = {
      name: name.trim() || "Cotización sin nombre",
      client_name: client.trim(),
      odoo_code: odooCode.trim(),
      elaborated_by: elaboratedBy.trim(),
      estimate_date: date,
      division_id: divisionId,
      params: paramsFrac,
      total: grand.total,
    };
    const payload = cats.map((c, ci) => ({
      category_id: c.category_id,
      name: c.name,
      color: c.color,
      sort_order: ci,
      items: c.items.map((it, ii) => ({
        description: it.description,
        manufacturer: it.manufacturer,
        qty: Number(it.qty) || 0,
        unit_price: Number(it.unit_price) || 0,
        kind: it.kind,
        unit: it.unit,
        sort_order: ii,
      })),
      labor: c.labor.map((l, li) => ({
        profile_id: l.profile_id,
        profile_name: l.profile_name,
        daily_rate: l.daily_rate,
        personas: Number(l.personas) || 0,
        dias: Number(l.dias) || 0,
        sort_order: li,
      })),
    }));
    const { error } = await supabase.rpc("nexus_save_estimate", {
      p_estimate: estimate.id,
      p_header: header,
      p_categories: payload,
    });
    return !error;
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (ok) {
      toast.success("Cotización guardada.");
      router.refresh();
    } else {
      toast.error("No se pudo guardar la cotización.");
    }
  }

  async function sendOdoo() {
    if (sending) return;
    setSending(true);
    if (!(await persist())) {
      setSending(false);
      toast.error("No se pudo guardar antes de enviar.");
      return;
    }
    const r = await sendToOdoo(estimate.id);
    setSending(false);
    if (r.ok) {
      toast.success(`Enviado a Odoo${r.orderName ? ` — ${r.orderName}` : ""}.`);
      router.refresh();
    } else {
      toast.error(r.error ?? "No se pudo enviar a Odoo.");
    }
  }

  async function exportExcel() {
    try {
      await exportEstimateExcel({
        name,
        client,
        odoo_code: odooCode,
        elaborated_by: elaboratedBy,
        date,
        params: paramsFrac,
        categories: cats.map((c) => ({
          name: c.name,
          items: c.items.map((it) => ({
            description: it.description,
            manufacturer: it.manufacturer,
            kind: it.kind,
            qty: Number(it.qty) || 0,
            unit_price: Number(it.unit_price) || 0,
          })),
          labor: c.labor.map((l) => ({
            profile_name: l.profile_name,
            personas: Number(l.personas) || 0,
            dias: Number(l.dias) || 0,
            daily_rate: l.daily_rate,
          })),
        })),
      });
    } catch {
      toast.error("No se pudo generar el Excel.");
    }
  }

  const pctField = (
    key: keyof typeof pct,
    label: string,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="0.5"
          className={inpR + " w-20"}
          value={pct[key]}
          onChange={(e) => setPct({ ...pct, [key]: e.target.value })}
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </label>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      {/* barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="min-w-0 flex-1 border-0 bg-transparent text-2xl font-semibold tracking-tight outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la cotización"
        />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Precio de venta
            </p>
            <p className="text-xl font-bold tabular-nums text-[#0f2044]">
              {money(grand.total)}
            </p>
          </div>
          <Button variant="outline" onClick={exportExcel}>
            <Download className="size-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={sendOdoo} disabled={sending}>
            <Send className="size-4" />
            {sending ? "Enviando…" : "Enviar a Odoo"}
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {/* encabezado + parámetros */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Cliente</span>
              <input className={inp} value={client} onChange={(e) => setClient(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Código Odoo (S00XXX)</span>
              <input
                className={inp}
                value={odooCode}
                onChange={(e) => setOdooCode(e.target.value)}
                placeholder="Ej. S00549"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Fecha</span>
              <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Elaborado por</span>
              <input className={inp} value={elaboratedBy} onChange={(e) => setElaboratedBy(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">División</span>
              <select
                className={inp}
                value={divisionId ?? ""}
                onChange={(e) => setDivisionId(e.target.value || null)}
              >
                <option value="">—</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Parámetros (%)
          </p>
          <div className="flex flex-wrap gap-3">
            {pctField("ind_oficina", "Ind. Oficina")}
            {pctField("ind_campo", "Ind. Campo")}
            {pctField("financiamiento", "Financiamiento")}
            {pctField("utilidad", "Utilidad")}
            {pctField("itbms", "ITBMS")}
          </div>
        </div>
      </div>

      {/* categorías */}
      <div className="space-y-4">
        {cats.map((c, ci) => {
          const bd = calcCascade(catBuckets[ci], paramsFrac);
          return (
            <div key={c.uid} className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between gap-2 border-b bg-[#0f2044]/[0.04] px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color ?? "#94a3b8" }}
                  />
                  <span className="truncate font-semibold">{c.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-muted-foreground">
                    Subtotal categoría:{" "}
                    <span className="font-medium text-foreground">{money(bd.total)}</span>
                  </span>
                  <button
                    onClick={() => removeCategory(c.uid)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    title="Quitar categoría"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {/* ítems */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-3 py-1.5 font-medium">Descripción</th>
                      <th className="w-32 px-3 py-1.5 font-medium">Fabricante</th>
                      <th className="w-32 px-3 py-1.5 font-medium">Tipo</th>
                      <th className="w-20 px-3 py-1.5 text-right font-medium">Cant.</th>
                      <th className="w-28 px-3 py-1.5 text-right font-medium">P. Unit.</th>
                      <th className="w-28 px-3 py-1.5 text-right font-medium">Costo</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {c.items.map((it) => (
                      <tr key={it.uid} className="border-b last:border-0">
                        <td className="px-3 py-1">
                          <input
                            className={inp}
                            value={it.description}
                            placeholder="Detector de humo…"
                            onChange={(e) => patchItem(c.uid, it.uid, { description: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            className={inp}
                            value={it.manufacturer}
                            placeholder="Notifier…"
                            onChange={(e) => patchItem(c.uid, it.uid, { manufacturer: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-1">
                          <select
                            className={inp}
                            value={it.kind}
                            onChange={(e) =>
                              patchItem(c.uid, it.uid, { kind: e.target.value as CostKind })
                            }
                          >
                            {KINDS.map((k) => (
                              <option key={k.v} value={k.v}>
                                {k.l}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="number"
                            className={inpR}
                            value={it.qty}
                            onChange={(e) => patchItem(c.uid, it.uid, { qty: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="number"
                            className={inpR}
                            value={it.unit_price}
                            onChange={(e) => patchItem(c.uid, it.uid, { unit_price: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">
                          {money((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => removeItem(c.uid, it.uid)}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {c.labor.map((l) => (
                      <tr key={l.uid} className="border-b bg-muted/20 last:border-0">
                        <td className="px-3 py-1" colSpan={2}>
                          <div className="flex items-center gap-2">
                            <Users className="size-3.5 shrink-0 text-muted-foreground" />
                            <select
                              className={inp}
                              value={l.profile_id ?? ""}
                              onChange={(e) => {
                                const p = laborProfiles.find((x) => x.id === e.target.value);
                                patchLabor(c.uid, l.uid, {
                                  profile_id: p?.id ?? null,
                                  profile_name: p?.name ?? l.profile_name,
                                  daily_rate: p?.daily_rate ?? l.daily_rate,
                                });
                              }}
                            >
                              {laborProfiles.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (${money(p.daily_rate)}/día)
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-1 text-xs text-muted-foreground">Mano de Obra</td>
                        <td className="px-3 py-1">
                          <input
                            type="number"
                            className={inpR}
                            value={l.personas}
                            title="Personas"
                            onChange={(e) => patchLabor(c.uid, l.uid, { personas: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="number"
                            className={inpR}
                            value={l.dias}
                            title="Días"
                            onChange={(e) => patchLabor(c.uid, l.uid, { dias: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">
                          {money((Number(l.personas) || 0) * (Number(l.dias) || 0) * l.daily_rate)}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => removeLabor(c.uid, l.uid)}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 px-3 py-2">
                <button
                  onClick={() => addItem(c.uid)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3.5" /> Ítem
                </button>
                <button
                  onClick={() => addLabor(c.uid)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Users className="size-3.5" /> Mano de obra
                </button>
              </div>
            </div>
          );
        })}

        {/* agregar categoría */}
        <div className="flex items-center gap-2">
          <select
            className={inp + " max-w-xs"}
            value={pickCat}
            onChange={(e) => setPickCat(e.target.value)}
          >
            <option value="">Agregar categoría…</option>
            {availCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={addCategory}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </div>

      {/* resumen (cascada) */}
      <div className="rounded-lg border">
        <div className="border-b bg-[#0f2044] px-4 py-2 text-sm font-semibold text-white">
          Resumen del proyecto
        </div>
        <div className="grid gap-x-8 gap-y-1.5 p-4 text-sm sm:grid-cols-2">
          <Row label="Costo base (Mat. + M.O. + Herram. + Flete)" value={grand.base} />
          <Row label={`Ind. Oficina (${pct.ind_oficina}%)`} value={grand.indOficina} />
          <Row label={`Ind. Campo (${pct.ind_campo}%)`} value={grand.indCampo} />
          <Row label={`Financiamiento (${pct.financiamiento}%)`} value={grand.financiamiento} />
          <Row label={`Utilidad (${pct.utilidad}%)`} value={grand.utilidad} />
          <Row label="Subtotal (sin ITBMS)" value={grand.subtotal} strong />
          <Row label={`ITBMS (${pct.itbms}%)`} value={grand.itbms} />
          <Row label="Total facturado al cliente" value={grand.total} strong />
        </div>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          Margen de utilidad:{" "}
          <span className="font-medium text-foreground">
            {(margin(grand) * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div
      className={
        "flex items-center justify-between gap-4 " +
        (strong ? "font-semibold text-[#0f2044]" : "")
      }
    >
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}
