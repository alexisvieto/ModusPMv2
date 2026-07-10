"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrgCreateSheet } from "@/components/admin/org-create-sheet";
import { ROLE_OPTIONS, UserCreateSheet } from "@/components/admin/user-create-sheet";
import { formatDate } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["org_role"];

export type MemberRow = {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
};
export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  createdAt: string;
  members: MemberRow[];
};

const roleLabel = (r: Role) => ROLE_OPTIONS.find((o) => o.v === r)?.l ?? r;

export function AdminBoard({ orgs }: { orgs: OrgRow[] }) {
  const router = useRouter();
  const [orgOpen, setOrgOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [defaultOrgId, setDefaultOrgId] = useState<string | null>(null);

  const orgOptions = orgs.map((o) => ({ id: o.id, name: o.name }));
  const totalUsers = orgs.reduce((n, o) => n + o.members.length, 0);

  function newUserFor(orgId: string | null) {
    setDefaultOrgId(orgId);
    setUserOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Empresas y usuarios
          </h1>
          <p className="text-sm text-muted-foreground">
            {orgs.length} empresa{orgs.length === 1 ? "" : "s"} · {totalUsers}{" "}
            usuario{totalUsers === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => newUserFor(null)}>
            <UserPlus className="size-4" />
            Nuevo usuario
          </Button>
          <Button size="sm" onClick={() => setOrgOpen(true)}>
            <Plus className="size-4" />
            Nueva empresa
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {orgs.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-primary" />
                    <span className="font-medium">{o.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {o.slug}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {o.legalName ? `${o.legalName} · ` : ""}creada{" "}
                    {formatDate(new Date(o.createdAt))}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => newUserFor(o.id)}
                >
                  <UserPlus className="size-4" />
                  Agregar usuario
                </Button>
              </div>

              {o.members.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Usuario</th>
                      <th className="px-4 py-2 font-medium">Correo</th>
                      <th className="px-4 py-2 font-medium">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.members.map((m) => (
                      <tr key={m.userId} className="border-b last:border-b-0">
                        <td className="px-4 py-2">{m.fullName || "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {m.email || "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {roleLabel(m.role)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  Sin usuarios todavía.
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {orgs.length === 0 && (
          <Card>
            <CardContent className="px-4 py-12 text-center text-sm text-muted-foreground">
              No hay empresas. Crea la primera con “Nueva empresa”.
            </CardContent>
          </Card>
        )}
      </div>

      <OrgCreateSheet
        open={orgOpen}
        onOpenChange={setOrgOpen}
        onCreated={() => router.refresh()}
      />
      <UserCreateSheet
        open={userOpen}
        onOpenChange={setUserOpen}
        orgs={orgOptions}
        defaultOrgId={defaultOrgId}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}
