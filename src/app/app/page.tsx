import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function AppHome() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (projects && projects.length > 0) {
    redirect(`/app/proyectos/${projects[0].id}`);
  }

  return (
    <div className="p-10 text-sm text-muted-foreground">
      Aún no tienes proyectos.
    </div>
  );
}
