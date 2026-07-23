"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Receipt,
  Settings2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrgCreateSheet } from "@/components/admin/org-create-sheet";
import {
  OrgBillingSheet,
  type BillingTarget,
} from "@/components/admin/org-billing-sheet";
import { ROLE_OPTIONS, UserCreateSheet } from "@/components/admin/user-create-sheet";
import { setMemberStatus } from "@/app/admin/actions";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["org_role"];
type MemberStatus = "active" | "suspended";

export type MemberRow = {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  status: MemberStatus;
};
export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  industry: string | null;
  createdAt: string;
  seatLimit: number | null;
  pricePerSeat: number;
  billingCurrency: string;
  billable: boolean;
  members: MemberRow[];
};

const roleLabel = (r: Role) => ROLE_OPTIONS.find((o) => o.v === r)?.l ?? r;
const activeSeats = (o: OrgRow) =>
  o.members.filter((m) => m.status === "active").length;

export function AdminBoard({ orgs }: { orgs: OrgRow[] }) {
  const router = useRouter();
  const [orgOpen, setOrgOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [defaultOrgId, setDefaultOrgId] = useState<string | null>(null);
  const [billingTarget, setBillingTarget] = useState<BillingTarget | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const orgOptions = orgs.map((o) => ({ id: o.id, name: o.name }));
  const totalUsers = orgs.reduce((n, o) => n + o.members.length, 0);

  // Facturación del mes: solo orgs facturables, asientos activos × precio.
  const billed = orgs.filter((o) => o.billable);
  const monthTotal = billed.reduce(
    (sum, o) => sum + activeSeats(o) * o.pricePerSeat,
    0,
  );

  function newUserFor(orgId: string | null) {
    setDefaultOrgId(orgId);
    setUserOpen(true);
  }

  function editPlan(o: OrgRow) {
    setBillingTarget({
      id: o.id,
      name: o.name,
      seatLimit: o.seatLimit,
      pricePerSeat: o.pricePerSeat,
      billable: o.billable,
      activeSeats: activeSeats(o),
    });
  }

  async function toggleStatus(o: OrgRow, m: MemberRow) {
    const next: MemberStatus = m.status === "active" ? "suspended" : "active";
    setPending(m.userId);
    const res = await setMemberStatus({
      organizationId: o.id,
      userId: m.userId,
      status: next,
    });
    setPending(null);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cambiar el estado.");
      return;
    }
    toast.success(next === "active" ? "Usuario reactivado." : "Usuario suspendido.");
    router.refresh();
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

      {/* Facturación del mes */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-primary" />
              <span className="font-medium">Facturación del mes</span>
            </div>
            <span className="text-lg font-semibold tabular-nums">
              {formatCurrency(monthTotal)}
            </span>
          </div>
          {billed.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Empresa</th>
                  <th className="px-4 py-2 text-right font-medium">Asientos</th>
                  <th className="px-4 py-2 text-right font-medium">Precio/mes</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {billed.map((o) => {
                  const seats = activeSeats(o);
                  return (
                    <tr key={o.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{o.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {seats}
                        {o.seatLimit !== null && (
                          <span className="text-muted-foreground">
                            {" "}
                            / {o.seatLimit}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(o.pricePerSeat)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(seats * o.pricePerSeat)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Ninguna empresa facturable todavía. Marca una en “Plan”.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {orgs.map((o) => {
          const seats = activeSeats(o);
          return (
            <Card key={o.id}>
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      <span className="font-medium">{o.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {o.slug}
                      </span>
                      <SeatBadge org={o} seats={seats} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {o.industry ? `${o.industry} · ` : ""}
                      {o.legalName ? `${o.legalName} · ` : ""}creada{" "}
                      {formatDate(new Date(o.createdAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editPlan(o)}
                    >
                      <Settings2 className="size-4" />
                      Plan
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => newUserFor(o.id)}
                    >
                      <UserPlus className="size-4" />
                      Agregar usuario
                    </Button>
                  </div>
                </div>

                {o.members.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Usuario</th>
                        <th className="px-4 py-2 font-medium">Correo</th>
                        <th className="px-4 py-2 font-medium">Rol</th>
                        <th className="px-4 py-2 font-medium">Estado</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {o.members.map((m) => {
                        const suspended = m.status === "suspended";
                        return (
                          <tr
                            key={m.userId}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-4 py-2">
                              {m.fullName || "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {m.email || "—"}
                            </td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                {roleLabel(m.role)}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {suspended ? (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  Suspendido
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                                  Activo
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={pending === m.userId}
                                onClick={() => toggleStatus(o, m)}
                              >
                                {suspended ? (
                                  <>
                                    <UserPlus className="size-4" />
                                    Reactivar
                                  </>
                                ) : (
                                  <>
                                    <UserMinus className="size-4" />
                                    Suspender
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
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
          );
        })}

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
      <OrgBillingSheet
        open={billingTarget !== null}
        onOpenChange={(o) => !o && setBillingTarget(null)}
        target={billingTarget}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function SeatBadge({ org, seats }: { org: OrgRow; seats: number }) {
  if (!org.billable) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Interna
      </span>
    );
  }
  const full = org.seatLimit !== null && seats >= org.seatLimit;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        full
          ? "bg-warning/15 text-warning"
          : "bg-primary/10 text-primary"
      }`}
    >
      {seats}
      {org.seatLimit !== null ? ` / ${org.seatLimit}` : ""} asiento
      {seats === 1 && org.seatLimit === null ? "" : "s"}
    </span>
  );
}
