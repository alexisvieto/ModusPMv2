import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  HardHat,
  PackageOpen,
  ShieldAlert,
  Users,
} from "lucide-react";

import { TIPO_PERMISOS, type PermitTypeKey } from "@/lib/hse/permits";
import { createClient } from "@/lib/supabase/server";

export default async function HseDashboard() {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle();
  const orgId = membership?.organization_id ?? null;

  if (!orgId) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-sm text-muted-foreground">
        Sin organización.
      </div>
    );
  }

  const [
    { data: empleados },
    { data: items },
    { data: asignaciones },
    { data: permits },
    { data: incidentes },
  ] = await Promise.all([
    supabase
      .from("hse_empleados")
      .select("id, nombre")
      .eq("organization_id", orgId)
      .eq("activo", true),
    supabase
      .from("hse_epp_items")
      .select("id, nombre, stock_actual, stock_minimo")
      .eq("organization_id", orgId)
      .eq("activo", true),
    supabase
      .from("hse_epp_asignaciones")
      .select("id, empleado_id, epp_id, fecha_vencimiento")
      .eq("organization_id", orgId)
      .eq("activo", true)
      .not("fecha_vencimiento", "is", null),
    supabase
      .from("hse_permits")
      .select("id, permit_type, ubicacion, fecha_fin, estado")
      .eq("organization_id", orgId),
    supabase
      .from("hse_incidentes")
      .select("id, tipo_evento, severidad, descripcion, fecha_evento, estado")
      .eq("organization_id", orgId)
      .neq("estado", "cerrado")
      .order("fecha_evento", { ascending: false }),
  ]);

  const empById = new Map((empleados ?? []).map((e) => [e.id, e.nombre]));
  const itemById = new Map((items ?? []).map((i) => [i.id, i.nombre]));

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0];

  const stockCritico = (items ?? []).filter(
    (i) => (i.stock_actual ?? 0) <= (i.stock_minimo ?? 0),
  );
  const porVencer = (asignaciones ?? [])
    .filter((a) => a.fecha_vencimiento && a.fecha_vencimiento <= in30)
    .sort((a, b) => (a.fecha_vencimiento! < b.fecha_vencimiento! ? -1 : 1));
  const permisosAbiertos = (permits ?? []).filter((p) =>
    ["pendiente", "aprobado"].includes(p.estado),
  );
  const permisosVencidos = permisosAbiertos.filter(
    (p) => p.fecha_fin && p.fecha_fin < today,
  );
  const incidentesAbiertos = incidentes ?? [];

  const TIPO_LABEL: Record<string, string> = {
    accidente: "Accidente",
    incidente: "Incidente",
    cuasi_accidente: "Cuasi-accidente",
  };
  const SEV_ORDER: Record<string, number> = { fatal: 0, grave: 1, moderado: 2, leve: 3 };
  const incidentesOrden = [...incidentesAbiertos].sort(
    (a, b) => (SEV_ORDER[a.severidad] ?? 9) - (SEV_ORDER[b.severidad] ?? 9),
  );

  const kpis = [
    { label: "Empleados", value: empById.size, icon: Users, href: "/app/hse/empleados" },
    { label: "Ítems EPP", value: itemById.size, icon: PackageOpen, href: "/app/hse/inventario" },
    { label: "Permisos abiertos", value: permisosAbiertos.length, icon: ClipboardCheck, href: "/app/hse/permisos" },
    { label: "Incidentes abiertos", value: incidentesAbiertos.length, icon: ShieldAlert, href: "/app/hse/incidentes" },
    { label: "Stock crítico", value: stockCritico.length, icon: HardHat, href: "/app/hse/inventario" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tablero HSE</h1>
        <p className="text-sm text-muted-foreground">
          Alertas de seguridad, stock y vencimientos.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link
              key={k.label}
              href={k.href}
              className="rounded-xl border bg-card p-4 transition-colors hover:border-[#0f2044]/30"
            >
              <Icon className="size-5 text-[#0f2044]" />
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#0f2044]">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Alertas */}
      <AlertCard
        title="Incidentes abiertos"
        icon={<ShieldAlert className="size-4" />}
        count={incidentesAbiertos.length}
        href="/app/hse/incidentes"
        empty="Sin incidentes abiertos."
      >
        {incidentesOrden.slice(0, 6).map((i) => (
          <Row
            key={i.id}
            left={`${TIPO_LABEL[i.tipo_evento] ?? i.tipo_evento} · ${i.descripcion}`}
            right={i.severidad}
            danger={i.severidad === "grave" || i.severidad === "fatal"}
          />
        ))}
      </AlertCard>

      <AlertCard
        title="Stock crítico"
        icon={<HardHat className="size-4" />}
        count={stockCritico.length}
        href="/app/hse/inventario"
        empty="Sin ítems bajo el mínimo."
      >
        {stockCritico.slice(0, 6).map((i) => (
          <Row key={i.id} left={i.nombre} right={`${i.stock_actual} / mín. ${i.stock_minimo}`} danger />
        ))}
      </AlertCard>

      <AlertCard
        title="EPP por vencer (30 días)"
        icon={<CalendarClock className="size-4" />}
        count={porVencer.length}
        href="/app/hse/despacho"
        empty="Nada por vencer."
      >
        {porVencer.slice(0, 6).map((a) => (
          <Row
            key={a.id}
            left={`${itemById.get(a.epp_id) ?? "EPP"} · ${empById.get(a.empleado_id) ?? "—"}`}
            right={a.fecha_vencimiento ?? ""}
            danger={!!a.fecha_vencimiento && a.fecha_vencimiento < today}
          />
        ))}
      </AlertCard>

      <AlertCard
        title="Permisos vencidos y abiertos"
        icon={<AlertTriangle className="size-4" />}
        count={permisosVencidos.length}
        href="/app/hse/permisos"
        empty="Sin permisos vencidos."
      >
        {permisosVencidos.slice(0, 6).map((p) => (
          <Row
            key={p.id}
            left={`${TIPO_PERMISOS[p.permit_type as PermitTypeKey]?.label ?? p.permit_type} · ${p.ubicacion ?? "—"}`}
            right={`venció ${p.fecha_fin}`}
            danger
          />
        ))}
      </AlertCard>
    </div>
  );
}

function AlertCard({
  title,
  icon,
  count,
  href,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  href: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
          {count > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {count}
            </span>
          )}
        </span>
        <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">
          Ver →
        </Link>
      </div>
      <div className="divide-y">
        {count === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Row({ left, right, danger }: { left: string; right: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <span className="min-w-0 truncate">{left}</span>
      <span
        className={
          "shrink-0 text-xs " + (danger ? "font-medium text-red-600" : "text-muted-foreground")
        }
      >
        {right}
      </span>
    </div>
  );
}
