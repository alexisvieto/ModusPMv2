"use client";

import { useMemo, useState } from "react";
import {
  Calculator,
  ChevronRight,
  ClipboardList,
  LifeBuoy,
  Lightbulb,
  Package,
  Receipt,
  Search,
} from "lucide-react";

import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  type HelpArticle,
  type HelpCategoryKey,
} from "@/lib/help/articles";

const ICONS: Record<string, typeof Package> = {
  ClipboardList,
  Calculator,
  Package,
  Receipt,
};

export function HelpCenter() {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return HELP_ARTICLES;
    return HELP_ARTICLES.filter((a) => {
      const hay = `${a.title} ${a.summary} ${a.steps.map((s) => s.text).join(" ")}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [q]);

  const byCategory = useMemo(() => {
    const m = new Map<HelpCategoryKey, HelpArticle[]>();
    for (const a of filtered) {
      const list = m.get(a.category) ?? [];
      list.push(a);
      m.set(a.category, list);
    }
    return m;
  }, [filtered]);

  const openArticle = openId
    ? HELP_ARTICLES.find((a) => a.id === openId) ?? null
    : null;

  if (openArticle) {
    return <ArticleView article={openArticle} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LifeBuoy className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centro de ayuda</h1>
          <p className="text-sm text-muted-foreground">
            Guías paso a paso de cada módulo. Busca o elige un tema.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en la ayuda…"
          className="h-10 w-full rounded-lg border border-input bg-transparent pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Sin resultados para “{q}”. Prueba con otra palabra.
        </p>
      ) : (
        <div className="space-y-8">
          {HELP_CATEGORIES.map((cat) => {
            const arts = byCategory.get(cat.key);
            if (!arts?.length) return null;
            const Icon = ICONS[cat.icon] ?? Package;
            return (
              <section key={cat.key}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">{cat.label}</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {arts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setOpenId(a.id)}
                      className="group flex items-start justify-between gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {a.summary}
                        </p>
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArticleView({
  article,
  onBack,
}: {
  article: HelpArticle;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className="size-4 rotate-180" />
        Centro de ayuda
      </button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{article.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p>
      </div>

      <ol className="space-y-6">
        {article.steps.map((step, i) => (
          <li key={i} className="flex gap-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm leading-relaxed">{step.text}</p>
              {step.note && (
                <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                  {step.note}
                </p>
              )}
              {step.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/help/${step.image}`}
                  alt={`Paso ${i + 1}`}
                  className="max-w-full rounded-lg border shadow-sm"
                  loading="lazy"
                  // Si un screenshot aún no existe, se oculta en vez de romper.
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>
          </li>
        ))}
      </ol>

      {article.tips && article.tips.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-warning">
            <Lightbulb className="size-4" />
            Buenas prácticas
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {article.tips.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-warning" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
