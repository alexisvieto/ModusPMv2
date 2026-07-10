import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// Limpieza diaria del storage efímero (cron de Vercel): elimina los PDF de
// análisis abandonados (>7 días sin completar). Los análisis terminados ya
// borran su PDF al aprobar; esto cubre los que quedaron a medias.
export async function GET(req: Request) {
  // Vercel manda "Authorization: Bearer ${CRON_SECRET}" cuando la env existe.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: stale } = await admin
    .from("takeoff_scope_docs")
    .select("id, organization_id, project_id, pdf_path")
    .not("pdf_path", "is", null)
    .neq("status", "analizado")
    .lt("created_at", cutoff);

  let removed = 0;
  for (const doc of stale ?? []) {
    const prefix = `${doc.organization_id}/${doc.project_id}/${doc.id}`;
    await admin.storage
      .from("takeoff-temp")
      .remove([doc.pdf_path!, `${prefix}/chunks.json`]);
    await admin
      .from("takeoff_scope_docs")
      .update({
        status: "error",
        progress: "Análisis abandonado: el PDF temporal se eliminó a los 7 días.",
        pdf_path: null,
        job_state: null,
      })
      .eq("id", doc.id);
    removed++;
  }

  return NextResponse.json({ ok: true, removed });
}
