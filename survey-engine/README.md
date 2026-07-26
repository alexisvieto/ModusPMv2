# Survey Engine — reportes PDF de Site Survey (Typst)

Microservicio que compila el **reporte de inspección de sitio** en PDF editorial
con [Typst](https://typst.app) y lo devuelve al app. Mismo patrón que
`takeoff-engine`: FastAPI + Docker en Railway, protegido por un secreto compartido.

## Cómo funciona

1. El app (Vercel) arma el JSON del survey (datos + URLs firmadas de fotos/firmas
   + marca del tenant) y hace `POST /render` con el header `X-Engine-Secret`.
2. El motor descarga las imágenes, escribe `data.json`, y compila
   `app/template.typ` con el binario oficial de Typst.
3. Devuelve el PDF (`application/pdf`). El app lo entrega para descarga.

- `GET /health` → liveness.
- `POST /render` → PDF. Body: `{ brand, survey, contacts, findings, photos, signatures }`.

Typst se instala en el Dockerfile desde el **release oficial fijado a v0.15.1**
(revisado). No se compila desde fuente.

## Deploy en Railway

- **New Service → Deploy from repo**, root directory = `survey-engine`.
- Railway detecta el `Dockerfile`. Auto-deploy desde `main`.
- Variable de entorno del servicio:
  - `ENGINE_SECRET` = un secreto largo aleatorio (el mismo que pondrás en Vercel).
- Railway inyecta `PORT` solo.

## Variables en Vercel (app)

- `SURVEY_ENGINE_URL` = URL pública del servicio Railway, **con** `https://`
  (ej. `https://survey-engine-production.up.railway.app`).
- `SURVEY_ENGINE_SECRET` = el mismo valor que `ENGINE_SECRET` del motor.

Sin estas variables, "Exportar PDF" responde 503 con un mensaje claro (no rompe).

## Local

```bash
docker build -t survey-engine survey-engine
docker run -p 8080:8080 -e ENGINE_SECRET=dev survey-engine
# POST http://localhost:8080/render  (header X-Engine-Secret: dev)
```

## Notas

- Marca por tenant: colores, logo, teléfono, correo, web y dirección salen de la
  tabla `organizations` — cada empresa exporta con SU identidad.
- Las imágenes llegan por URL (firmadas), nunca en el body.
- `template.typ` es la plantilla editorial; ajustar ahí el diseño.
