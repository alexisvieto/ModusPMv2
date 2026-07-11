# Takeoff Engine — motor de conteo de planos

Servicio Python (FastAPI + PyMuPDF) que cuenta los elementos de un plano de
sistemas especiales. Corre **aparte** de la app Next (contenedor en
Railway / Fly.io / Cloud Run), no en Vercel.

## Interfaz

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Liveness. |
| POST | `/legend` | `{pdf_url, system_type}` → recorte JPG de la leyenda (Next lo lee con visión). |
| POST | `/render` | `{pdf_url}` → JPG del plano completo (overlay del visor). |
| POST | `/analyze` | `{pdf_url, system_type, symbols[]}` → `{id}` del job (async). |
| GET | `/jobs/{id}` | Estado/progreso/resultado del conteo. |

Auth: header `X-Engine-Secret` con el secreto compartido. Los PDF llegan por
**URL firmada** (nunca en el body).

`analyze` devuelve detecciones `{element_key, x, y, confidence, method}` con
coordenadas normalizadas 0-1.

## Local (entorno idéntico a producción)

```bash
cd takeoff-engine
export ENGINE_SECRET=dev-secret
docker compose up --build          # http://localhost:8080
# o sin Docker:
python -m venv .venv && . .venv/Scripts/activate   # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
ENGINE_SECRET=dev-secret uvicorn app.main:app --reload --port 8080
```

Probar:

```bash
curl -s localhost:8080/health
```

## Despliegue

**Railway / Fly.io / Cloud Run** — el `Dockerfile` es autosuficiente.
Variable de entorno requerida en el servicio:

- `ENGINE_SECRET` — el mismo valor que en Next (`TAKEOFF_ENGINE_SECRET`).

En **Next / Vercel** configurar:

- `TAKEOFF_ENGINE_URL` — URL pública del servicio (p.ej. `https://takeoff-engine.up.railway.app`).
- `TAKEOFF_ENGINE_SECRET` — el secreto compartido.

## Estructura

```
app/
  main.py      — FastAPI: endpoints + auth + cola
  engine.py    — motor de conteo (Ruta A: texto + geometría + validación cruzada)
  legend.py    — localiza/renderiza la leyenda y el plano completo
  jobs.py      — cola interna en memoria (job store)
  pdf_io.py    — descarga por URL firmada
  schemas.py   — contrato (Pydantic)
  config.py    — settings
```

El motor (`engine.py`) aprende las firmas geométricas de la **leyenda del propio
plano** — no hardcodea tamaños. Se calibra verificando el MÉTODO contra planos
reales con conteo conocido (p.ej. ACI-03), sin ajustar umbrales a un plano
específico.
