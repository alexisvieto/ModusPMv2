"""
Motor de reportes de Site Survey.

POST /render  → recibe los datos del survey (JSON) + URLs de imágenes,
               descarga las imágenes, compila un PDF editorial con Typst y
               devuelve el PDF.
GET  /health  → liveness.

Auth: header X-Engine-Secret con el secreto compartido. No es público.
Las imágenes llegan por URL (firmadas de Supabase / logo público), nunca en el body.
"""
from __future__ import annotations

import asyncio
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from .config import (
    COMPILE_TIMEOUT,
    DOWNLOAD_TIMEOUT,
    ENGINE_SECRET,
    MAX_IMAGE_BYTES,
    MAX_IMAGES,
)

app = FastAPI(title="Survey Engine", version="1.0")

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
TEMPLATE = Path(__file__).parent / "template.typ"
EXT_BY_TYPE = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


# ---------- modelos ----------
class ImageRef(BaseModel):
    url: str
    caption: str = ""


class SigRef(BaseModel):
    signer_name: str
    signer_role: str = ""
    signed_at: str = ""
    url: str


class Contact(BaseModel):
    name: str = ""
    role: str = ""
    phone: str = ""
    email: str = ""
    notes: str = ""


class Finding(BaseModel):
    title: str = ""
    description: str = ""
    severity: str = "media"


class Brand(BaseModel):
    name: str = ""
    legal_name: str = ""
    primary: str = "#F79A02"
    accent: str = "#F8BA00"
    dark: str = "#2D2D2D"
    website: str = ""
    email: str = ""
    phone: str = ""
    address: str = ""
    logo_url: str = ""
    credit: bool = True


class Survey(BaseModel):
    client: str = ""
    project: str = ""
    odoo_code: str = ""
    site: str = ""
    date: str = ""
    engineer: str = ""
    personnel: str = "0"
    field_days: str = "0"
    notes: str = ""
    status: str = ""


class RenderRequest(BaseModel):
    brand: Brand
    survey: Survey
    contacts: list[Contact] = []
    findings: list[Finding] = []
    photos: list[ImageRef] = []
    signatures: list[SigRef] = []
    filename: str = "reporte-site-survey"


async def require_secret(x_engine_secret: str = Header(default="")) -> None:
    if not ENGINE_SECRET or x_engine_secret != ENGINE_SECRET:
        raise HTTPException(status_code=401, detail="No autorizado")


def _hex_or(value: str, fallback: str) -> str:
    return value if HEX.match(value or "") else fallback


async def _download(client: httpx.AsyncClient, url: str, dest_dir: Path, stem: str) -> str | None:
    """Descarga una imagen a dest_dir; devuelve la ruta relativa o None si falla."""
    if not url or not url.lower().startswith(("http://", "https://")):
        return None
    try:
        async with client.stream("GET", url) as r:
            if r.status_code != 200:
                return None
            ext = EXT_BY_TYPE.get((r.headers.get("content-type") or "").split(";")[0].strip(), ".jpg")
            path = dest_dir / f"{stem}{ext}"
            size = 0
            with open(path, "wb") as f:
                async for chunk in r.aiter_bytes():
                    size += len(chunk)
                    if size > MAX_IMAGE_BYTES:
                        f.close()
                        path.unlink(missing_ok=True)
                        return None
                    f.write(chunk)
        return f"images/{path.name}"
    except Exception as e:  # noqa: BLE001
        print(f"[survey-engine] download failed {url[:80]}: {e}", flush=True)
        return None


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "survey-engine"}


@app.post("/render")
async def render(req: RenderRequest, _: None = Depends(require_secret)) -> Response:
    tmp = Path(tempfile.mkdtemp(prefix="survey_"))
    images = tmp / "images"
    images.mkdir()
    try:
        # Sanitiza colores (evita fallos de compilación por valores no-hex).
        brand = req.brand.model_dump()
        brand["primary"] = _hex_or(brand["primary"], "#F79A02")
        brand["accent"] = _hex_or(brand["accent"], "#F8BA00")
        brand["dark"] = _hex_or(brand["dark"], "#2D2D2D")

        total_imgs = len(req.photos) + len(req.signatures) + (1 if req.brand.logo_url else 0)
        if total_imgs > MAX_IMAGES:
            raise HTTPException(status_code=413, detail="Demasiadas imágenes")

        async with httpx.AsyncClient(
            timeout=DOWNLOAD_TIMEOUT, follow_redirects=True
        ) as client:
            brand["logo"] = await _download(client, req.brand.logo_url, images, "logo") or ""

            photos = []
            for i, p in enumerate(req.photos):
                local = await _download(client, p.url, images, f"photo_{i}")
                if local:
                    photos.append({"path": local, "caption": p.caption})

            signatures = []
            for i, sg in enumerate(req.signatures):
                local = await _download(client, sg.url, images, f"sig_{i}")
                signatures.append(
                    {
                        "path": local or "",
                        "signer_name": sg.signer_name,
                        "signer_role": sg.signer_role,
                        "signed_at": sg.signed_at,
                    }
                )

        data = {
            "brand": brand,
            "survey": req.survey.model_dump(),
            "contacts": [c.model_dump() for c in req.contacts],
            "findings": [f.model_dump() for f in req.findings],
            "photos": photos,
            "signatures": signatures,
        }
        (tmp / "data.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        shutil.copy(TEMPLATE, tmp / "template.typ")

        out = tmp / "out.pdf"
        proc = await asyncio.to_thread(
            subprocess.run,
            [
                "typst",
                "compile",
                "--root",
                str(tmp),
                str(tmp / "template.typ"),
                str(out),
            ],
            capture_output=True,
            timeout=COMPILE_TIMEOUT,
        )
        if proc.returncode != 0 or not out.exists():
            err = proc.stderr.decode("utf-8", "replace")[:1500]
            print(f"[survey-engine] typst failed: {err}", flush=True)
            raise HTTPException(status_code=500, detail=f"Fallo al compilar el PDF: {err}")

        pdf = out.read_bytes()
        safe = re.sub(r"[^\w\-]+", "_", req.filename).strip("_") or "reporte"
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{safe}.pdf"'},
        )
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
