"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ImageUp, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createOrganization, uploadOrgLogo } from "@/app/admin/actions";
import { BRAND_PRESETS, INDUSTRIES } from "@/lib/org-options";

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OrgCreateSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [industry, setIndustry] = useState("");
  const [contactName, setContactName] = useState("");
  const [brandPrimary, setBrandPrimary] = useState(BRAND_PRESETS[3].primary);
  const [brandAccent, setBrandAccent] = useState(BRAND_PRESETS[3].accent);
  const [brandDark, setBrandDark] = useState(BRAND_PRESETS[3].dark);
  const [customColors, setCustomColors] = useState(false);
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [exportCredit, setExportCredit] = useState(true);
  const [seatLimit, setSeatLimit] = useState("");
  const [pricePerSeat, setPricePerSeat] = useState("");
  const [billable, setBillable] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Limpia el formulario al abrir (ajuste de estado en render, sin efecto).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setLegalName("");
      setSlug("");
      setSlugEdited(false);
      setIndustry("");
      setContactName("");
      setBrandPrimary(BRAND_PRESETS[3].primary);
      setBrandAccent(BRAND_PRESETS[3].accent);
      setBrandDark(BRAND_PRESETS[3].dark);
      setCustomColors(false);
      setWebsite("");
      setContactEmail("");
      setContactPhone("");
      setAddress("");
      setLogoUrl("");
      setUploadingLogo(false);
      setExportCredit(true);
      setSeatLimit("");
      setPricePerSeat("");
      setBillable(true);
      setSaving(false);
    }
  }

  function onName(v: string) {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  function applyPreset(p: (typeof BRAND_PRESETS)[number]) {
    setBrandPrimary(p.primary);
    setBrandAccent(p.accent);
    setBrandDark(p.dark);
  }

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("El logo debe ser PNG o JPEG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El logo no debe pesar más de 2 MB.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setUploadingLogo(true);
    const res = await uploadOrgLogo(fd);
    setUploadingLogo(false);
    if (!res.ok || !res.url) {
      toast.error(res.error ?? "No se pudo subir el logo.");
      return;
    }
    setLogoUrl(res.url);
    toast.success("Logo subido.");
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Ponle un nombre a la empresa.");
      return;
    }
    const limit = seatLimit.trim() === "" ? null : Number(seatLimit);
    if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
      toast.error("El tope de asientos debe ser un número (o vacío = sin tope).");
      return;
    }
    const price = pricePerSeat.trim() === "" ? 0 : Number(pricePerSeat);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("El precio por asiento debe ser un número ≥ 0.");
      return;
    }
    setSaving(true);
    const res = await createOrganization({
      name,
      legalName,
      slug,
      industry,
      contactName,
      brandPrimary,
      brandAccent,
      brandDark,
      website,
      contactEmail,
      contactPhone,
      address,
      logoUrl,
      exportCredit,
      seatLimit: limit,
      pricePerSeat: price,
      billable,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo crear la empresa.");
      return;
    }
    toast.success("Empresa creada.");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Nueva empresa</SheetTitle>
          <SheetDescription>
            Crea un tenant con su marca. Su logo y colores saldrán
            automáticamente en todos los reportes que genere.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <Label htmlFor="o-name">Nombre de la organización</Label>
            <Input
              id="o-name"
              placeholder="Ej. Acme Energía"
              value={name}
              onChange={(e) => onName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-legal">Razón social</Label>
              <Input
                id="o-legal"
                placeholder="Acme Energía, S.A."
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-slug">Slug</Label>
              <Input
                id="o-slug"
                placeholder="acme-energia"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-industry">Rubro</Label>
              <select
                id="o-industry"
                className={fieldCls}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-contact">Nombre de contacto</Label>
              <Input
                id="o-contact"
                placeholder="Ej. Ana Pérez"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-1.5">
            <Label>Logo (PNG o JPEG)</Label>
            <div className="flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <ImageUp className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={onPickLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ImageUp className="size-4" />
                  )}
                  {uploadingLogo
                    ? "Subiendo…"
                    : logoUrl
                      ? "Cambiar logo"
                      : "Subir logo"}
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setLogoUrl("")}
                  >
                    <Trash2 className="size-4" />
                    Quitar
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Fondo transparente (PNG) se ve mejor en los reportes.
            </p>
          </div>

          {/* Paleta de colores */}
          <div className="space-y-2">
            <Label>Paleta de color</Label>
            <div className="grid grid-cols-5 gap-2">
              {BRAND_PRESETS.map((p) => {
                const active =
                  p.primary === brandPrimary &&
                  p.accent === brandAccent &&
                  p.dark === brandDark;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    title={p.label}
                    className={`relative flex h-10 items-center justify-center overflow-hidden rounded-md border transition-all ${
                      active
                        ? "ring-2 ring-ring ring-offset-1"
                        : "hover:opacity-90"
                    }`}
                    style={{ backgroundColor: p.primary }}
                  >
                    <span
                      className="absolute bottom-0 right-0 h-3 w-3"
                      style={{ backgroundColor: p.accent }}
                    />
                    {active && (
                      <Check className="size-4 text-white drop-shadow" />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setCustomColors((v) => !v)}
            >
              {customColors ? "Ocultar" : "Personalizar colores"}
            </button>
            {customColors && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <ColorField label="Primario" value={brandPrimary} onChange={setBrandPrimary} />
                <ColorField label="Acento" value={brandAccent} onChange={setBrandAccent} />
                <ColorField label="Oscuro" value={brandDark} onChange={setBrandDark} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-web">Sitio web</Label>
              <Input
                id="o-web"
                placeholder="www.acme.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-mail">Correo de contacto</Label>
              <Input
                id="o-mail"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-phone">Teléfono</Label>
              <Input
                id="o-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-addr">Dirección</Label>
              <Input
                id="o-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <Label className="text-xs font-medium text-muted-foreground">
              Plan de facturación
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="o-seats">Tope de asientos</Label>
                <Input
                  id="o-seats"
                  inputMode="numeric"
                  placeholder="Sin tope"
                  value={seatLimit}
                  onChange={(e) => setSeatLimit(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-price">Precio/asiento/mes (US$)</Label>
                <Input
                  id="o-price"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={pricePerSeat}
                  onChange={(e) => setPricePerSeat(e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Entra al reporte de facturación
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={exportCredit}
              onChange={(e) => setExportCredit(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Mostrar crédito “by Nexera” en los exportables (freemium)
          </label>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || uploadingLogo}>
            {saving ? "Creando…" : "Crear empresa"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldCls}
        />
      </div>
    </div>
  );
}
