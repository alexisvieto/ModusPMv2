"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { daysUntil, dueLabel, PRIORITY_META, type PunchPriority } from "@/lib/punch";
import { toISODate } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Alert = {
  id: string;
  description: string;
  responsible: string | null;
  priority: PunchPriority;
  due_date: string;
};

export function PunchAlerts({ projectId }: { projectId: string | null }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!projectId) {
      setAlerts([]);
      return;
    }
    const supabase = createClient();
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      const t = new Date();
      const plus2 = toISODate(
        new Date(t.getFullYear(), t.getMonth(), t.getDate() + 2),
      );
      const { data } = await supabase
        .from("punch_items")
        .select("id, description, responsible, priority, due_date")
        .eq("project_id", projectId!)
        .neq("status", "done")
        .not("due_date", "is", null)
        .lte("due_date", plus2)
        .order("due_date", { ascending: true });
      if (active && data) setAlerts(data as Alert[]);
    }

    const scheduleLoad = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (active) load();
      }, 400);
    };

    load();
    const channel = supabase
      .channel(`punch-alerts-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "punch_items",
          filter: `project_id=eq.${projectId}`,
        },
        () => scheduleLoad(),
      )
      .subscribe();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  if (!projectId) return null;
  const count = alerts.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Pendientes por vencer"
        className="relative rounded-full p-2 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
          {count > 0
            ? `${count} pendiente${count === 1 ? "" : "s"} por vencer`
            : "Sin pendientes por vencer"}
        </div>
        <DropdownMenuSeparator />
        {alerts.map((a) => {
          const pm = PRIORITY_META[a.priority];
          const overdue = daysUntil(a.due_date) < 0;
          return (
            <DropdownMenuItem
              key={a.id}
              onClick={() =>
                router.push(`/app/proyectos/${projectId}/pendientes`)
              }
              className="flex-col items-start gap-0.5"
            >
              <div className="flex w-full items-center gap-2">
                <span className={cn("size-1.5 shrink-0 rounded-full", pm.dot)} />
                <span className="truncate text-sm">{a.description}</span>
              </div>
              <div className="flex w-full items-center justify-between pl-3.5 text-xs">
                <span className="text-muted-foreground">
                  {a.responsible ?? "—"}
                </span>
                <span
                  className={cn(
                    "font-medium",
                    overdue ? "text-destructive" : "text-warning",
                  )}
                >
                  {dueLabel(a.due_date)}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                router.push(`/app/proyectos/${projectId}/pendientes`)
              }
              className="justify-center text-primary"
            >
              Ver todos los pendientes
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
