"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@moduspm.com");
  const [password, setPassword] = useState("Demo1234!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message || "No pudimos iniciar sesión. Revisa tu correo y contraseña.",
      );
      setLoading(false);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <span className="font-mono text-sm font-bold">M</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Modus
              <span className="ml-1 font-mono font-medium text-primary">PM</span>
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Bienvenido de vuelta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa para administrar tus proyectos
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2 h-10 w-full">
              {loading ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </div>

        <div className="mt-4 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Demo:</span>{" "}
          demo@moduspm.com · Demo1234!
        </div>
      </div>
    </main>
  );
}
