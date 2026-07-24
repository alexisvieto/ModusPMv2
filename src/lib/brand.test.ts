import { describe, it, expect } from "vitest";

import { brandFromOrg, brandInitial, DEFAULT_BRAND, type OrgBranding } from "@/lib/brand";

const BASE: OrgBranding = {
  name: "X",
  legal_name: null,
  brand_primary: null,
  brand_accent: null,
  brand_dark: null,
  logo_url: null,
  website: null,
  contact_email: null,
  contact_name: null,
  contact_phone: null,
  address: null,
  export_credit: null,
};

describe("brandFromOrg", () => {
  it("usa el fallback del producto cuando no hay org", () => {
    expect(brandFromOrg(null)).toEqual(DEFAULT_BRAND);
    expect(brandFromOrg(undefined)).toEqual(DEFAULT_BRAND);
  });

  it("prefiere legal_name y aplica color/contacto de la org; cae al default por campo", () => {
    const brand = brandFromOrg({
      ...BASE,
      name: "Acme",
      legal_name: "Acme S.A.",
      brand_primary: "#123456",
      contact_email: "hi@acme.io",
      export_credit: false,
    });
    expect(brand.name).toBe("Acme S.A.");
    expect(brand.primary).toBe("#123456");
    expect(brand.accent).toBe(DEFAULT_BRAND.accent); // sin valor → default
    expect(brand.email).toBe("hi@acme.io");
    expect(brand.exportCredit).toBe(false);
  });

  it("bloquea logos con esquema peligroso (XSS) y permite https:// o same-origin", () => {
    expect(brandFromOrg({ ...BASE, logo_url: "javascript:alert(1)" }).logoUrl).toBeNull();
    expect(brandFromOrg({ ...BASE, logo_url: "data:image/png;base64,AAAA" }).logoUrl).toBeNull();
    expect(brandFromOrg({ ...BASE, logo_url: "https://cdn.acme.io/l.png" }).logoUrl).toBe(
      "https://cdn.acme.io/l.png",
    );
    expect(brandFromOrg({ ...BASE, logo_url: "/local.png" }).logoUrl).toBe("/local.png");
  });

  it("export_credit null → true (freemium por defecto)", () => {
    expect(brandFromOrg(BASE).exportCredit).toBe(true);
  });
});

describe("brandInitial", () => {
  it("toma la inicial en mayúscula del nombre de marca", () => {
    expect(brandInitial({ ...DEFAULT_BRAND, name: "acme" })).toBe("A");
  });
});
