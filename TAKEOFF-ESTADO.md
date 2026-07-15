# Cálculo de Planos (Takeoff) — Estado y hoja de ruta

> **Alto puesto el 2026-07-15.** Nota viva para retomar. La spec detallada vive en
> `INSTRUCCIONES_MODULO_CALCULO_PLANOS.md` (local, NO en git). El detalle técnico
> fino está en la memoria del proyecto (`modus-pm-takeoff.md`).

## Principio que rige todo
**Confiable > rápido. El motor entiende la leyenda ANTES de contar; nada se cuenta
sobre un diccionario sin confirmar; nada se descarta en silencio; no se hardcodean
símbolos de un plano (los símbolos salen de la leyenda de CADA plano).**

## Cómo funciona hoy (arquitectura)
1. **Dos fases obligatorias.** Subís el plano →
   - **Fase 1 `sheet-legend`**: el motor propone el diccionario de la leyenda
     (visión sin sesgo + `symbol_library` aprendido + convenciones como
     sugerencias, con badge de origen). NO cuenta. Hoja queda en estado `leyenda`.
   - **Confirmación humana** en el visor (agregás/corregís/borrás filas).
   - **Fase 2 `sheet-count`**: cuenta con el diccionario **confirmado** (sin piso),
     y cada fila confirmada **enseña** a `symbol_library` (confirmar = enseñar).
2. **Detección** = geometría vectorial determinística (círculos por firma Bézier +
   tamaño moda; cajas-X por intersección de diagonales; etiquetas de texto).
3. **Clasificación en capas:** (1) leyenda confirmada · (2) `symbol_library`
   (aprendido por firma) · (3) **lectura de glifos** — para los círculos que la
   geometría encuentra pero no matchean por texto, el motor recorta cada uno y los
   manda a visión en UNA llamada (mosaico) para leer la marca interna y mapearla
   por la leyenda. La geometría encuentra; la visión solo lee lo encontrado.
4. **Aprendizaje (el visor es la fuente de datos):** escritor batch append-only
   (`corrections`) → `symbol_library` (firmas `leyenda|SYM`, `circulo|P`,
   `texto|E-1`, `circulo|~N`). Reclasificar/confirmar/agregar/rescatar-candidato
   enseña; hay propagación por firma similar. El lector aplica lo aprendido en el
   próximo plano/análisis.
5. **Verificación (visor):** confirmación de leyenda, marcadores por tipo, dudosos,
   selección en bloque (click-a-click + rectángulo/Shift), acciones masivas,
   candidatos descartados (toggle + rescate), atajos C/X/A/N/P, revisión guiada,
   auditoría en hover. Aprobar = consolida cantidades para costos + borra el PDF.

## Infra
- Motor Python (FastAPI + PyMuPDF) en **Railway** (auto-deploy desde `main`, root
  dir `takeoff-engine`, secreto `ENGINE_SECRET` = `TAKEOFF_ENGINE_SECRET` en
  Vercel; `TAKEOFF_ENGINE_URL` **con** `https://`). App en Vercel (auto-deploy).
- PDFs por URL firmada; nunca en el body. Aislamiento multi-tenant por RLS + FKs
  compuestas + FORCE RLS.

## DÓNDE QUEDAMOS (lo que sigue)
- **[PRIORIDAD] Validar la lectura de glifos** (commit `d02da0f`): probar
  "Volver a contar" en un plano cuyo detector es un glifo interno (p.ej. humo="H")
  y confirmar cuántos clasifica. Riesgo a verificar: alineación del recorte con la
  rotación de la página.
- **Cachear el glifo**: fingerprint geométrico del glifo → `symbol_library` para
  que la próxima sea geometría pura (hoy la visión de glifos corre en cada conteo
  con círculos sin_clasificar; costo acotado, 1 llamada).
- **Lote 2.3 — zonas de exclusión marcables** (rectángulo "ignorar zona", por hoja
  + patrón aprendible). Motor + esquema + UI.
- **Lote 3.7 — undo/redo** sobre los eventos append-only (backend ya listo).
- **Lote 3.5 — sincronía lista↔plano** (requiere lista por detección, no por tipo).
- **Lote 3.9 — contraste con pliego** (depende del módulo de pliegos).
- **Extracción de firma retroactiva** en adds manuales de punto vacío.

## Reglas de trabajo (recordatorio)
Verificar antes de declarar (`tsc`/`eslint`/`py_compile` en 0; el usuario prueba en
prod). Commit/push solo cuando se pide (push = deploy). Cada cambio del motor toca
Railway; el resto, Vercel. La honestidad sobre límites (p.ej. círculos idénticos
sin marca no se pueden distinguir automáticamente) es parte del entregable.
