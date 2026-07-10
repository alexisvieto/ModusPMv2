"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound } from "lucide-react";

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
import { createUserForOrg } from "@/app/admin/actions";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["org_role"];

const fieldCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export const ROLE_OPTIONS: { v: Role; l: string }[] = [
  { v: "owner", l: "Dueño (owner)" },
  { v: "admin", l: "Administrador" },
  { v: "project_manager", l: "Gerente de proyecto" },
  { v: "member", l: "Miembro" },
  { v: "viewer", l: "Solo lectura" },
];

export function UserCreateSheet({
  open,
  onOpenChange,
  orgs,
  defaultOrgId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgs: { id: string; name: string }[];
  defaultOrgId?: string | null;
  onCreated: () => void;
}) {
  const [organizationId, setOrganizationId] = useState(defaultOrgId ?? "");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("owner");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  // Limpia el formulario al abrir (ajuste de estado en render, sin efecto).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setOrganizationId(defaultOrgId ?? "");
      setFullName("");
      setTitle("");
      setEmail("");
      setRole("owner");
      setSaving(false);
      setResult(null);
      setCopied(false);
    }
  }

  async function save() {
    if (!organizationId) {
      toast.error("Selecciona una empresa.");
      return;
    }
    if (!fullName.trim() || !email.trim()) {
      toast.error("Completa nombre y correo.");
      return;
    }
    setSaving(true);
    const res = await createUserForOrg({
      organizationId,
      email,
      fullName,
      title,
      role,
    });
    setSaving(false);
    if (!res.ok || !res.tempPassword) {
      toast.error(res.error ?? "No se pudo crear el usuario.");
      return;
    }
    setResult({ email: res.email ?? email, tempPassword: res.tempPassword });
    onCreated();
  }

  async function copyPw() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Nuevo usuario</SheetTitle>
          <SheetDescription>
            Crea un acceso y asígnalo a una empresa con su rol.
          </SheetDescription>
        </SheetHeader>

        {result ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="rounded-md border border-success/40 bg-success/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-success">
                <Check className="size-4" />
                Usuario creado
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Comparte estas credenciales con la persona. La contraseña
                temporal <strong>no se vuelve a mostrar</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Correo</Label>
              <Input readOnly value={result.email} />
            </div>

            <div className="space-y-1.5">
              <Label>Contraseña temporal</Label>
              <div className="flex items-center gap-2">
                <div className="flex h-9 flex-1 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 font-mono text-sm">
                  <KeyRound className="size-4 text-muted-foreground" />
                  {result.tempPassword}
                </div>
                <Button variant="outline" size="sm" onClick={copyPw}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-org">Empresa</Label>
              <select
                id="u-org"
                className={fieldCls}
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-name">Nombre completo</Label>
              <Input
                id="u-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="u-title">Cargo</Label>
                <Input
                  id="u-title"
                  placeholder="Ej. Gerente"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-role">Rol</Label>
                <select
                  id="u-role"
                  className={fieldCls}
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-email">Correo</Label>
              <Input
                id="u-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        )}

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Listo</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Creando…" : "Crear usuario"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
