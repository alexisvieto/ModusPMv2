"use server";

import { randomBytes } from "crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["org_role"];

type OrgInput = {
  name: string;
  legalName: string;
  slug: string;
  brandPrimary: string;
  brandAccent: string;
  brandDark: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  logoUrl: string;
  exportCredit: boolean;
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
      brand_primary: clean(input.brandPrimary),
      brand_accent: clean(input.brandAccent),
      brand_dark: clean(input.brandDark),
      website: clean(input.website),
      contact_email: clean(input.contactEmail),
      contact_phone: clean(input.contactPhone),
      address: clean(input.address),
      logo_url: clean(input.logoUrl),
      export_credit: input.exportCredit,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "No se pudo crear la empresa." };

  revalidatePath("/admin");
  return { ok: true, orgId: data.id };
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
    .select("id")
    .eq("id", input.organizationId)
    .maybeSingle();
  if (!org) return { ok: false, error: "Empresa no encontrada." };

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
