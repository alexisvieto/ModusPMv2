# Know-How de Construcción — Modus PM

> **Qué es esto:** la *forma* en que construimos Modus PM — el método, no la descripción de la app.
> Es nuestra **constante de trabajo**: el estándar del que partimos y que mejoramos poco a poco.
> Si una práctica nueva demuestra ser mejor (o aprendemos de un error), se actualiza aquí.
>
> **v1 · 2026-06-15.** Mantenerla **corta y real** vale más que exhaustiva.

---

## 0. Principios

- **Verificar antes de declarar.** Nada está "listo" hasta que se probó. Si algo falla, se dice con la evidencia — no se maquilla.
- **Cero ruido.** `tsc` y `eslint` en **0** siempre. Así un error nuevo *salta* en vez de esconderse entre viejos.
- **El servidor es la seguridad; el cliente es UX.** Toda restricción real se valida en el backend (RLS / `has_org_role`). Deshabilitar en el cliente es solo experiencia, nunca la defensa.
- **Multi-tenant sagrado.** Nunca se filtra data ni marca entre organizaciones.
- **Transparencia.** Se reportan interpretaciones, supuestos y lo que se adaptó. Si algo contradice lo descrito (p. ej. una key comentada), se levanta la mano antes de seguir.
- **Construir al estilo del repo.** El código nuevo se lee como el de al lado: nombres, idioma (español), idioms y densidad de comentarios.
- **Mínimo y enfocado.** Se cambia lo necesario para el pedido, no de más.

## 1. Flujo por cada cambio

1. **Entender** el pedido. Si hay una bifurcación real (afecta qué se construye), se pregunta — con una **recomendación**, no un catálogo.
2. **Leer** el código vecino y, en Next, la doc local (`node_modules/next/dist/docs/`). *No es el Next que crees* (ver `AGENTS.md`).
3. **Implementar** al estilo del repo.
4. **Verificar** (§2).
5. **Reportar** el resultado con honestidad (qué quedó, qué falta, qué se asumió).
6. **Commit / push** solo cuando se pide (§3).

## 2. Verificación (la disciplina)

- **Tipos:** `npx tsc --noEmit` → 0 errores.
- **Lint:** `npm run lint` → 0 problemas. **Sin `eslint-disable` en masa.** Excepciones solo por línea y comentadas (p. ej. guards de hidratación / efectos de suscripción legítimos).
- **Smoke funcional:** para cambios de UI o comportamiento, **Playwright** (login demo → navegar → aserciones → captura). Se instala como dev-dep de un solo uso y se **desinstala al terminar** (el repo queda limpio).
- **Mirar la captura** de verdad cuando es visual o un exportable — no asumir que se ve bien.
- **Datos:** se verifica con consulta de conteo/**diff** (p. ej. `EXCEPT` para confirmar que una copia quedó idéntica).
- **Limpieza:** scripts y archivos temporales se borran al terminar.

## 3. Git y entregas

- **Commits:** mensaje en español, claro; cuerpo con viñetas de *qué* y *por qué*; cierra con `Co-Authored-By: Claude ...`.
- **Un commit = un cambio lógico.**
- **Commit y push solo cuando el usuario lo pide.** Push = deploy de producción (Vercel) → se confirma antes.
- No se saltan hooks ni se fuerza nada sin permiso.

## 4. Patrones de código

- **Next.js 16 / React 19 (App Router).** Middleware = `src/proxy.ts`. Cómputo server-side por defecto.
- **Exportables conscientes de marca:** `docPalette(brand)` — cada tenant exporta con SU color, nunca hardcodeado. Crédito Nexera **discreto y subordinado** a la marca del cliente + flag freemium `organizations.export_credit` (el tier "full" lo apaga).
- **Multi-tenant:** `organization_id` + RLS (`is_org_member`). Las páginas (server) cargan y pasan `brand` y los datos; el cliente no consulta lo que no le toca.
- **Admin-gating en 2 capas:** servidor (`has_org_role(owner/admin)`, el enforcement real) + cliente (deshabilita controles + aviso claro).
- **Secretos fuera del cliente:** se strippean antes de mandar al browser (p. ej. `safeItems`), las llaves viven en **Vault** con RPC *write-only*, `ANTHROPIC_API_KEY` solo server (nunca `NEXT_PUBLIC`).
- **React sin `setState` síncrono en efectos:** patrón "ajuste de estado en render" con guard, o `key` para remontar. Solo hidratación/suscripción legítimas llevan disable por línea documentado.
- **Móvil:** tabla `hidden md:block` + tarjetas `md:hidden`; los módulos de campo son **mobile-first**.

## 5. Base de datos y datos

- **DDL → `apply_migration`; datos → `execute_sql`.**
- **RPC `SECURITY DEFINER`:** `search_path` fijo, se **auto-autorizan** (`has_org_role`), grant a `authenticated`. *Write-only* cuando manejan secretos.
- **Operaciones de datos:** investigar (leer esquema + datos reales) → confirmar la estructura → ejecutar → **verificar con diff**. Nunca asumir la forma de los datos.
- **`get_advisors`** (security) después de cambios de esquema; los WARN ya evaluados y aceptados no se re-litigan.

## 6. IA / Claude

- **Modelo:** `claude-opus-4-8` para razonamiento/análisis; `sonnet` para resúmenes baratos. (La elección es revisable por costo/latencia.)
- **Anti-inyección:** los datos del usuario van en bloque delimitado y se tratan **como datos, nunca como instrucciones**. Auth + rate-limit en las rutas.
- **BYOK:** config de IA por tenant; lo sensible (llave, presupuesto, modelo, switch) es **admin-only**. *Usar* la IA (generar análisis) es para cualquier miembro.

## 7. Decisiones y colaboración

- Se **recomienda**, no se hace un catálogo de opciones. Para bifurcaciones reales, `AskUserQuestion` con una opción recomendada.
- **Juicio sobre las auditorías:** los hallazgos se aplican con criterio, no a ciegas (se rechaza lo que no aplica y se explica por qué).
- **Auditorías periódicas** con los agentes **Software Architect** + **Code Reviewer**, con lentes distintas (arquitectura vs. bugs/seguridad), en modo solo-lectura; el dueño revisa cada hallazgo.
- Lo que se adapta o se asume, se dice explícitamente.

## 8. Memoria

- Se persiste lo **no obvio** (decisiones, entorno, estado del proyecto, fechas absolutas) en la memoria del proyecto y se actualiza el índice. No se guarda lo que el repo ya documenta (estructura, historial de git).

## 9. Cómo evolucionar esta guía

Es un documento **vivo**. Cuando una práctica nueva demuestre ser mejor, o tropecemos con algo, se actualiza aquí y se sube la versión arriba. La regla: **corta, real y aplicada** > larga y teórica.
