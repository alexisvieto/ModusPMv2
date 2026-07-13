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


class Signature(BaseModel):
    """Firma geométrica de una detección: base para agrupar por similitud y
    para aprender en symbol_library. kind = tipo de evidencia; token = letra o
    texto asociado; size = tamaño en pt (círculos)."""

    kind: Literal["circulo", "caja_x", "texto"]
    token: Optional[str] = None
    size: Optional[float] = None


class Detection(BaseModel):
    element_key: str
    x: float  # centro normalizado 0-1
    y: float
    confidence: Literal["alta", "media", "baja"]
    method: Literal["texto", "geometria", "vision", "manual"]
    signature: Optional[Signature] = None


class Candidate(BaseModel):
    """Geometría que el motor vio pero NO clasificó (círculo de tamaño distinto a
    la moda, etc.). Se muestra en el visor para rescatarla — nunca se descarta en
    silencio."""

    kind: Literal["circulo", "caja"]
    x: float  # centro normalizado 0-1
    y: float
    size: Optional[float] = None


class AnalyzeResult(BaseModel):
    detections: list[Detection]
    candidates: list[Candidate] = Field(default_factory=list)
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
