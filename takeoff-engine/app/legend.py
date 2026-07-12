"""
Localiza la leyenda del plano y la renderiza en alta resolución.

Next NO puede recortar la leyenda (requiere PyMuPDF): este paso vive aquí.
Devuelve el recorte como JPG para que Next haga la lectura con visión (con su
gate de presupuesto/BYOK) y obtenga el diccionario símbolo→elemento.
"""
from __future__ import annotations

import base64

import fitz

from .schemas import LegendResponse, RenderResponse


def _find_legend_rect(page: "fitz.Page") -> "fitz.Rect | None":
    """Busca el rótulo de la leyenda y devuelve un rectángulo a su alrededor."""
    rect = page.rect
    W, H = rect.width, rect.height
    for kw in ("SIMBOLOG", "LEYENDA"):
        hits = page.search_for(kw, quads=False)
        if hits:
            r = hits[0]
            # bloque hacia abajo-derecha del rótulo (la tabla de símbolos)
            return fitz.Rect(
                max(0, r.x0 - 0.01 * W),
                max(0, r.y0 - 0.01 * H),
                min(W, r.x0 + 0.30 * W),
                min(H, r.y1 + 0.32 * H),
            )
    return None


def render_legend(pdf_bytes: bytes, page_index: int = 0) -> LegendResponse:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc.load_page(page_index)
        rect = page.rect
        W, H = float(rect.width) or 1.0, float(rect.height) or 1.0

        legend_rect = _find_legend_rect(page)
        found = legend_rect is not None
        # Sin rótulo: recorte de la esquina inferior-izquierda (ubicación típica).
        clip = legend_rect or fitz.Rect(0, H * 0.62, W * 0.42, H)

        # Alta resolución (zoom 4x) para que el texto pequeño de la leyenda sea
        # legible por el modelo de visión.
        pix = page.get_pixmap(matrix=fitz.Matrix(4, 4), clip=clip, alpha=False)
        jpg = pix.tobytes("jpeg", jpg_quality=85)

        # is_vector: ¿hay texto/vectores? (para avisar de escaneados → Ruta B)
        char_count = len(page.get_text("text"))
        try:
            n_draw = len(page.get_drawings())
        except Exception:
            n_draw = 0
        is_vector = char_count > 40 or n_draw > 20

        return LegendResponse(
            image_base64=base64.b64encode(jpg).decode("ascii"),
            found=found,
            page_width=W,
            page_height=H,
            is_vector=is_vector,
        )
    finally:
        doc.close()


def render_full(pdf_bytes: bytes, page_index: int = 0) -> RenderResponse:
    """Plano completo a resolución media, para el overlay del visor."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc.load_page(page_index)
        rect = page.rect
        W, H = float(rect.width) or 1.0, float(rect.height) or 1.0
        # Zoom acotado por el lado mayor (máx ~3000px): un plano de arquitectura
        # a 2x fijo genera un pixmap de ~100MB que puede tumbar el contenedor.
        # El overlay usa coordenadas normalizadas, así que el tamaño absoluto en
        # píxeles no afecta la precisión de los marcadores. Calidad 60.
        zoom = min(2.0, 3000.0 / max(W, H))
        zoom = max(zoom, 0.75)
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        jpg = pix.tobytes("jpeg", jpg_quality=60)
        return RenderResponse(
            image_base64=base64.b64encode(jpg).decode("ascii"),
            page_width=W,
            page_height=H,
        )
    finally:
        doc.close()
