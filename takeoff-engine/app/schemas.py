from typing import Literal, Optional

from pydantic import BaseModel, Field

# ── Interfaz del motor (contrato con Next) ──


class Symbol(BaseModel):
    """Una entrada del diccionario de leyenda: símbolo → elemento del catálogo."""

    symbol: str  # etiqueta/abreviatura tal como aparece en el plano (p.ej. "P")
    element_key: str  # clave del catálogo (p.ej. "detector_humo")
    name: str = ""


class LegendRequest(BaseModel):
    pdf_url: str
    system_type: str


class LegendResponse(BaseModel):
    """Recorte de la leyenda para que Next haga la lectura con visión."""

    image_base64: str  # JPG del recorte de la leyenda
    found: bool  # ¿se localizó una zona de leyenda?
    page_width: float
    page_height: float
    is_vector: bool


class AnalyzeRequest(BaseModel):
    pdf_url: str
    system_type: str
    symbols: list[Symbol] = Field(default_factory=list)
    page_index: int = 0


class Detection(BaseModel):
    element_key: str
    x: float  # centro normalizado 0-1
    y: float
    confidence: Literal["alta", "media", "baja"]
    method: Literal["texto", "geometria", "vision", "manual"]


class AnalyzeResult(BaseModel):
    detections: list[Detection]
    is_vector: bool
    page_width: float
    page_height: float
    # Diagnóstico (duración, conteos por método) para logging/observabilidad.
    stats: dict = Field(default_factory=dict)


class RenderRequest(BaseModel):
    pdf_url: str
    page_index: int = 0


class RenderResponse(BaseModel):
    """Imagen del plano completo (para el overlay del visor de verificación)."""

    image_base64: str
    page_width: float
    page_height: float


class Job(BaseModel):
    id: str
    status: Literal["encolado", "procesando", "listo", "error"]
    progress: Optional[str] = None
    result: Optional[AnalyzeResult] = None
    error: Optional[str] = None
