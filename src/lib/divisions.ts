// =========================================================
// Divisiones de empresa (Departamentos) y sus módulos.
// OJO: distinto de `nexus_divisions` (categorías de cotización).
// El mapa división→módulos es de CÓDIGO (los módulos son fijos); las divisiones
// y la membresía viven en la base (`departments` / `department_members`).
// =========================================================

import {
  Briefcase,
  Calculator,
  FolderKanban,
  HardHat,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type DeptKey = "comercial" | "operaciones" | "hse";

export type ModuleCard = {
  name: string;
  tagline: string;
  href: string;
  icon: LucideIcon;
};

export const DIVISION_ICON: Record<string, LucideIcon> = {
  comercial: Briefcase,
  operaciones: Wrench,
  hse: ShieldCheck,
};

// Ícono por defecto para divisiones futuras que no estén en el mapa.
export const DEFAULT_DIVISION_ICON: LucideIcon = FolderKanban;

export const DIVISION_MODULES: Record<string, ModuleCard[]> = {
  comercial: [
    {
      name: "Nexus Cálculo",
      tagline: "Presupuestos y cotizaciones",
      href: "/app/nexus",
      icon: Calculator,
    },
  ],
  operaciones: [
    {
      name: "Nexus PM",
      tagline: "Gestión de proyectos",
      href: "/app/inicio",
      icon: FolderKanban,
    },
  ],
  // El site survey ahora es el formato PY-F-014 (Documentos y formatos), no un
  // módulo aparte. El módulo "Nexus Survey" genérico queda retirado del portal.
  hse: [
    {
      name: "Nexus HSE",
      tagline: "Seguridad y permisos de trabajo",
      href: "/app/hse",
      icon: HardHat,
    },
  ],
};
