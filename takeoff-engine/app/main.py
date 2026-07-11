"""
Servicio del motor de conteo de planos (Takeoff).

Endpoints:
  GET  /health                 → liveness
  POST /legend  {pdf_url,...}  → recorte de la leyenda (para visión en Next)
  POST /analyze {pdf_url,...}  → encola conteo, responde {job_id} de inmediato
  GET  /jobs/{id}              → estado/progreso/resultado del conteo

Auth: header X-Engine-Secret con el secreto compartido. El servicio no es
público. Los PDF llegan por URL firmada (nunca en el body).
"""
from __future__ import annotations

import time

from fastapi import Depends, FastAPI, Header, HTTPException

from . import engine, legend
from .config import ENGINE_SECRET
from .jobs import store
from .pdf_io import download_pdf
from .schemas import (
    AnalyzeRequest,
    AnalyzeResult,
    Job,
    LegendRequest,
    LegendResponse,
    RenderRequest,
    RenderResponse,
)

app = FastAPI(title="Takeoff Engine", version="1.0")


async def require_secret(x_engine_secret: str = Header(default="")) -> None:
    if not ENGINE_SECRET or x_engine_secret != ENGINE_SECRET:
        raise HTTPException(status_code=401, detail="No autorizado")


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "takeoff-engine"}


@app.post("/legend", response_model=LegendResponse)
async def legend_endpoint(req: LegendRequest, _: None = Depends(require_secret)) -> LegendResponse:
    pdf = await download_pdf(req.pdf_url)
    return legend.render_legend(pdf)


@app.post("/render", response_model=RenderResponse)
async def render_endpoint(req: RenderRequest, _: None = Depends(require_secret)) -> RenderResponse:
    pdf = await download_pdf(req.pdf_url)
    return legend.render_full(pdf, req.page_index)


@app.post("/analyze", response_model=Job)
async def analyze_endpoint(req: AnalyzeRequest, _: None = Depends(require_secret)) -> Job:
    job = store.create()

    async def work() -> AnalyzeResult:
        store.set_progress(job.id, "Descargando plano…")
        pdf = await download_pdf(req.pdf_url)
        store.set_progress(job.id, "Contando elementos…")
        t0 = time.monotonic()
        result = engine.count(pdf, req.system_type, req.symbols, req.page_index)
        result.stats["duration_ms"] = round((time.monotonic() - t0) * 1000)
        # Logging de duración por hoja (observabilidad).
        print(
            f"[engine] analyze done: {len(result.detections)} detections "
            f"in {result.stats['duration_ms']}ms | stats={result.stats}",
            flush=True,
        )
        return result

    store.spawn(job.id, work)
    return job


@app.get("/jobs/{job_id}", response_model=Job)
async def job_status(job_id: str, _: None = Depends(require_secret)) -> Job:
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return job
