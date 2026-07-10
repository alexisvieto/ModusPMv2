"use client";

import { useState } from "react";
import { toast } from "sonner";

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
import { createOrganization } from "@/app/admin/actions";

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
  const [brandPrimary, setBrandPrimary] = useState("#0F766E");
  const [brandAccent, setBrandAccent] = useState("#14B8A6");
  const [brandDark, setBrandDark] = useState("#1F2937");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [exportCredit, setExportCredit] = useState(true);
  const [saving, setSaving] = useState(false);

  // Limpia el formulario al abrir (ajuste de estado en render, sin efecto).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setName("");
      setLegalName("");
      setSlug("");
      setSlugEdited(false);
      setBrandPrimary("#0F766E");
      setBrandAccent("#14B8A6");
      setBrandDark("#1F2937");
      setWebsite("");
      setContactEmail("");
      setContactPhone("");
      setAddress("");
      setLogoUrl("");
      setExportCredit(true);
      setSaving(false);
    }
  }

  function onName(v: string) {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Ponle un nombre a la empresa.");
      return;
    }
    setSaving(true);
    const res = await createOrganization({
      name,
      legalName,
      slug,
      brandPrimary,
      brandAccent,
      brandDark,
      website,
      contactEmail,
      contactPhone,
      address,
      logoUrl,
      exportCredit,
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
            Crea un tenant nuevo con su marca. Luego podrás crear su usuario
            owner para que entren.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <Label htmlFor="o-name">Nombre</Label>
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

          <div className="space-y-1.5">
            <Label>Colores de marca</Label>
            <div className="grid grid-cols-3 gap-3">
              <ColorField label="Primario" value={brandPrimary} onChange={setBrandPrimary} />
              <ColorField label="Acento" value={brandAccent} onChange={setBrandAccent} />
              <ColorField label="Oscuro" value={brandDark} onChange={setBrandDark} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-logo">URL del logo (https)</Label>
            <Input
              id="o-logo"
              placeholder="https://…/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
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
          <Button onClick={save} disabled={saving}>
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
