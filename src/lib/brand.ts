// =========================================================
// Marca por-tenant. Cada organización guarda su identidad y
// los exportables (PDF, Excel) usan la marca de la org activa.
// =========================================================

export type Brand = {
  name: string; // nombre legal/comercial para documentos
  primary: string; // hex
  accent: string; // hex
  dark: string; // hex
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
};

/** Fallback al producto cuando una org no tiene marca configurada. */
export const DEFAULT_BRAND: Brand = {
  name: "Modus PM",
  primary: "#0F766E",
  accent: "#14B8A6",
  dark: "#1F2937",
  website: null,
  email: null,
  phone: null,
  address: null,
  logoUrl: null,
};

/** Columnas de branding que se seleccionan de `organizations`. */
export type OrgBranding = {
  name: string;
  legal_name: string | null;
  brand_primary: string | null;
  brand_accent: string | null;
  brand_dark: string | null;
  logo_url: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
};

/** Solo permite logos same-origin (/…) o https:// (evita data:/javascript:). */
function safeLogo(url: string | null): string | null {
  if (!url) return null;
  return /^(https:\/\/|\/)/.test(url) ? url : null;
}

export function brandFromOrg(org: OrgBranding | null | undefined): Brand {
  if (!org) return DEFAULT_BRAND;
  return {
    name: org.legal_name || org.name || DEFAULT_BRAND.name,
    primary: org.brand_primary || DEFAULT_BRAND.primary,
    accent: org.brand_accent || DEFAULT_BRAND.accent,
    dark: org.brand_dark || DEFAULT_BRAND.dark,
    website: org.website,
    email: org.contact_email,
    phone: org.contact_phone,
    address: org.address,
    logoUrl: safeLogo(org.logo_url),
  };
}

/** Inicial para el sello del header cuando no hay logo. */
export function brandInitial(brand: Brand): string {
  return (brand.name.trim()[0] ?? "M").toUpperCase();
}

/** Columnas a seleccionar de `organizations` para construir el Brand. */
export const ORG_BRAND_COLUMNS =
  "name, legal_name, brand_primary, brand_accent, brand_dark, logo_url, website, contact_email, contact_phone, address";
