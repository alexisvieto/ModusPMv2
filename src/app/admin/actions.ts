"use server";

import { randomBytes } from "crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INDUSTRIES, type Industry } from "@/lib/org-options";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["org_role"];

type OrgInput = {
  name: string;
  legalName: string;
  slug: string;
  industry: string;
  contactName: string;
  brandPrimary: string;
  brandAccent: string;
  brandDark: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  logoUrl: string;
  exportCredit: boolean;
  seatLimit: number | null;
  pricePerSeat: number;
  billable: boolean;
};

type UserInput = {
  organizationId: string;
  email: string;
  fullName: string;
  title: string;
  role: Role;
};

/** Verifica que quien llama sea super-admin de plataforma (gate real en servidor). */
async function requirePlatformAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autorizado." };
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) {
    return {
      ok: false,
      error: "Solo el super-admin de plataforma puede realizar esta acción.",
    };
  }
  return { ok: true };
}

const clean = (s: string) => s.trim() || null;

export async function createOrganization(
  input: OrgInput,
): Promise<{ ok: boolean; error?: string; orgId?: string }> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  if (!name) return { ok: false, error: "Ponle un nombre a la empresa." };
  if (!/^[a-z0-9-]{2,}$/.test(slug)) {
    return {
      ok: false,
      error: "El slug solo admite minúsculas, números y guiones (mín. 2).",
    };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { ok: false, error: "Ya existe una empresa con ese slug." };

  const { data, error } = await admin
    .from("organizations")
    .insert({
      name,
      slug,
      legal_name: clean(input.legalName),
      industry: INDUSTRIES.includes(input.industry as Industry)
        ? (input.industry as Industry)
        : null,
      contact_name: clean(input.contactName),
      brand_primary: clean(input.brandPrimary),
      brand_accent: clean(input.brandAccent),
      brand_dark: clean(input.brandDark),
      website: clean(input.website),
      contact_email: clean(input.contactEmail),
      contact_phone: clean(input.contactPhone),
      address: clean(input.address),
      logo_url: clean(input.logoUrl),
      export_credit: input.exportCredit,
      seat_limit: normalizeSeatLimit(input.seatLimit),
      price_per_seat: normalizePrice(input.pricePerSeat),
      billable: input.billable,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "No se pudo crear la empresa." };

  revalidatePath("/admin");
  return { ok: true, orgId: data.id };
}

/**
 * Sube el logo de una organización al bucket público `org-logos` y devuelve
 * su URL pública. Solo super-admin. PNG/JPEG hasta 2 MB (los reportes lo
 * incrustan tal cual; SVG no sirve para el Excel).
 */
export async function uploadOrgLogo(
  form: FormData,
): Promise<{ ok: boolean; error?: string; url?: string }> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No se recibió el archivo." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "El logo no debe pesar más de 2 MB." };
  }
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/jpeg"
        ? "jpg"
        : null;
  if (!ext) {
    return { ok: false, error: "Formato no válido. Usa PNG o JPEG." };
  }

  const admin = createAdminClient();
  // Nombre único sin depender de Date/Math (no disponibles): bytes aleatorios.
  const path = `${randomBytes(16).toString("hex")}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from("org-logos")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: "No se pudo subir el logo." };

  const { data } = admin.storage.from("org-logos").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/** Tope de asientos: entero ≥ 0, o null (sin tope). */
function normalizeSeatLimit(v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  return Math.max(0, Math.floor(v));
}

/** Precio por asiento: número ≥ 0 con 2 decimales. */
function normalizePrice(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.round(v * 100) / 100;
}

/** Cuenta los asientos activos (facturables) de una empresa. */
async function countActiveSeats(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
): Promise<number> {
  const { count } = await admin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active");
  return count ?? 0;
}

/** Edita el plan de facturación de una empresa (tope, precio, facturable). */
export async function updateOrgBilling(input: {
  organizationId: string;
  seatLimit: number | null;
  pricePerSeat: number;
  billable: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminClient();
  const seatLimit = normalizeSeatLimit(input.seatLimit);

  // No dejar el tope por debajo de los asientos ya activos: sería mentir el reporte.
  if (seatLimit !== null) {
    const active = await countActiveSeats(admin, input.organizationId);
    if (seatLimit < active) {
      return {
        ok: false,
        error: `La empresa ya tiene ${active} asiento(s) activo(s); el tope no puede ser menor. Suspende usuarios primero.`,
      };
    }
  }

  const { error } = await admin
    .from("organizations")
    .update({
      seat_limit: seatLimit,
      price_per_seat: normalizePrice(input.pricePerSeat),
      billable: input.billable,
    })
    .eq("id", input.organizationId);
  if (error) return { ok: false, error: "No se pudo actualizar el plan." };

  revalidatePath("/admin");
  return { ok: true };
}

/** Suspende o reactiva un asiento. Suspender = sin acceso y no factura. */
export async function setMemberStatus(input: {
  organizationId: string;
  userId: string;
  status: "active" | "suspended";
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminClient();

  // Reactivar cuenta contra el tope, igual que crear.
  if (input.status === "active") {
    const { data: org } = await admin
      .from("organizations")
      .select("seat_limit")
      .eq("id", input.organizationId)
      .maybeSingle();
    if (org?.seat_limit !== null && org?.seat_limit !== undefined) {
      const active = await countActiveSeats(admin, input.organizationId);
      if (active >= org.seat_limit) {
        return {
          ok: false,
          error: `Esta empresa usó sus ${org.seat_limit} asiento(s). Súbele el tope para reactivar a alguien.`,
        };
      }
    }
  }

  const { error } = await admin
    .from("organization_members")
    .update({ status: input.status })
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };

  revalidatePath("/admin");
  return { ok: true };
}

/** Contraseña temporal robusta (base64url). Se muestra una sola vez al admin. */
function generateTempPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

export async function createUserForOrg(
  input: UserInput,
): Promise<{ ok: boolean; error?: string; email?: string; tempPassword?: string }> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email) return { ok: false, error: "Falta el correo." };
  if (!fullName) return { ok: false, error: "Falta el nombre." };
  if (!input.organizationId)
    return { ok: false, error: "Selecciona una empresa." };

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, seat_limit")
    .eq("id", input.organizationId)
    .maybeSingle();
  if (!org) return { ok: false, error: "Empresa no encontrada." };

  // Tope de asientos: no crear más usuarios activos de los contratados.
  if (org.seat_limit !== null) {
    const active = await countActiveSeats(admin, input.organizationId);
    if (active >= org.seat_limit) {
      return {
        ok: false,
        error: `Esta empresa usó sus ${org.seat_limit} asiento(s). Súbele el tope para agregar más usuarios.`,
      };
    }
  }

  const tempPassword = generateTempPassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created?.user) {
    const dup = /registered|already|exists/i.test(createErr?.message ?? "");
    return {
      ok: false,
      error: dup ? "Ese correo ya tiene una cuenta." : "No se pudo crear el usuario.",
    };
  }
  const userId = created.user.id;

  // Perfil: upsert por si existe un trigger que ya lo creó. Si falla,
  // deshacemos el usuario (una cuenta sin perfil se ve sin nombre en toda la app).
  const { error: profErr } = await admin
    .from("profiles")
    .upsert({ id: userId, full_name: fullName, title: clean(input.title) }, {
      onConflict: "id",
    });
  if (profErr) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "No se pudo crear el perfil del usuario." };
  }

  // Membresía. Si falla, deshacemos el usuario para no dejar huérfanos.
  const { error: memErr } = await admin
    .from("organization_members")
    .insert({
      user_id: userId,
      organization_id: input.organizationId,
      role: input.role,
    });
  if (memErr) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "No se pudo asignar el usuario a la empresa." };
  }

  revalidatePath("/admin");
  return { ok: true, email, tempPassword };
}
