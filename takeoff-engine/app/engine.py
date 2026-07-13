"""
Motor de conteo de planos — Ruta A (vectorial), determinístico.

Validado contra ACI-03 (Riga/Hotel Escuela). Métodos por naturaleza del símbolo:
  · Detectores (círculos): firma geométrica (curvas Bézier, aspecto ~1:1) con
    tamaño = MODA de la distribución (no hardcodeado) + letra cercana → tipo.
  · Bocinas/estrobos (cajas-con-X): pares de diagonales ~45° opuestas cuya
    INTERSECCIÓN cae dentro de ambos segmentos (captura X en 2 tramos o en
    medios-tramos; robusto a fragmentación de paths).
  · Extintores, gas, ACI, módulos… (etiquetas de texto): tokens que casan con
    un símbolo del diccionario y NO fueron consumidos por un círculo.

Coordenadas: todo en el espacio del pixmap del visor (page.rotation_matrix +
normalización por sus dimensiones) → conteo, zonas y overlay comparten 0-1.

Filosofía: el motor NO se equivoca con confianza ALTA (círculo+letra, texto
exacto); lo geométrico sin etiqueta va con confianza MEDIA para verificación.

Interfaz pura (sin UI):  count(pdf_bytes, system_type, symbols) → AnalyzeResult
"""
from __future__ import annotations

import collections
import math

import fitz  # PyMuPDF

from .schemas import AnalyzeResult, Detection, Signature, Symbol

PARAMS = {
    "circle_curves_min": 3,
    "circle_ratio": (0.7, 1.4),
    "circle_size_min_pt": 5,
    "circle_size_max_pt": 30,
    "size_tol": 0.10,
    "dedup_dist": 0.002,
    "letter_dist": 0.013,
    # cajas-con-X (bocina/estrobo)
    "xdiag_len": (10, 25),      # largo de la diagonal (pt) — excluye hatching de 6pt
    "xdiag_45_tol": 4,          # |abs(dx)-abs(dy)| < tol → ~45°
    "xdiag_center_max": 18,     # (pt) máx separación entre centros de las 2 diagonales
    "xdedup_pt": 4,             # (pt) dedup de X
    # texto
    "text_max_len": 12,
    # zonas a excluir
    "legend_w": 0.20,
    "legend_h": 0.24,
    "titleblock_x": 0.86,       # franja derecha (cajetín)
    "border_corner": 0.13,      # esquina sup-izq (borde decorativo)
}


def _transform(page: "fitz.Page"):
    pm = page.get_pixmap(matrix=fitz.Matrix(1, 1))
    PW, PH = float(pm.width), float(pm.height)
    rot = page.rotation_matrix

    def T(x: float, y: float):
        q = fitz.Point(x, y) * rot
        return q.x / PW, q.y / PH

    return T, PW, PH


def _circles(drawings, T):
    lo, hi = PARAMS["circle_size_min_pt"], PARAMS["circle_size_max_pt"]
    rmin, rmax = PARAMS["circle_ratio"]
    out = []
    for d in drawings:
        r = d.get("rect")
        if not r:
            continue
        nc = sum(1 for it in d.get("items", []) if it and it[0] == "c")
        w_, h_ = abs(r.x1 - r.x0), abs(r.y1 - r.y0)
        if nc >= PARAMS["circle_curves_min"] and h_ > 0 and rmin < w_ / h_ < rmax and lo <= w_ <= hi:
            cx, cy = T((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
            out.append((cx, cy, round(w_, 1)))
    return out


def _seg_intersection(s1, s2):
    x1, y1, x2, y2 = s1
    x3, y3, x4, y4 = s2
    d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(d) < 1e-6:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
    u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / d
    if -0.25 <= t <= 1.25 and -0.25 <= u <= 1.25:
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
    return None


def _xboxes(drawings, T):
    """Cajas-con-X por intersección de diagonales opuestas ~45° (10-25pt)."""
    lo, hi = PARAMS["xdiag_len"]
    tol = PARAMS["xdiag_45_tol"]
    pos, neg = [], []  # '/' y '\'
    for d in drawings:
        for it in d.get("items", []):
            if not it or it[0] != "l":
                continue
            a, b = it[1], it[2]
            dx, dy = b.x - a.x, b.y - a.y
            L = math.hypot(dx, dy)
            if lo <= L <= hi and abs(abs(dx) - abs(dy)) < tol:
                (pos if dx * dy > 0 else neg).append((a.x, a.y, b.x, b.y))
    used = [False] * len(neg)
    xs = []
    for s1 in pos:
        c1 = ((s1[0] + s1[2]) / 2, (s1[1] + s1[3]) / 2)
        for j, s2 in enumerate(neg):
            if used[j]:
                continue
            c2 = ((s2[0] + s2[2]) / 2, (s2[1] + s2[3]) / 2)
            if math.hypot(c1[0] - c2[0], c1[1] - c2[1]) > PARAMS["xdiag_center_max"]:
                continue
            if _seg_intersection(s1, s2):
                used[j] = True
                xs.append(((c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2))
                break
    # dedup en pt, luego normalizar
    uniq = []
    for pt in xs:
        if not any(math.hypot(pt[0] - u[0], pt[1] - u[1]) < PARAMS["xdedup_pt"] for u in uniq):
            uniq.append(pt)
    return [T(x, y) for (x, y) in uniq]


def _dedup_norm(points):
    uniq = []
    for c in points:
        if not any(math.hypot(c[0] - u[0], c[1] - u[1]) < PARAMS["dedup_dist"] for u in uniq):
            uniq.append(c)
    return uniq


def count(pdf_bytes: bytes, system_type: str, symbols: list[Symbol], page_index: int = 0) -> AnalyzeResult:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc.load_page(page_index)
        T, PW, PH = _transform(page)

        # Geometría vectorial: se pide UNA sola vez y se reparte entre círculos
        # y cajas-con-X. En planos densos (200k+ paths) pedirla dos veces duplica
        # el pico de memoria y puede tumbar el contenedor.
        drawings = page.get_drawings()

        # Texto (con índice, para rastrear consumo por token)
        words = []  # (idx, texto, x, y)
        char_count = 0
        for i, w in enumerate(page.get_text("words")):
            t = str(w[4]).strip()
            char_count += len(t)
            if not t:
                continue
            x, y = T((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
            words.append((i, t, x, y))

        # Zona de leyenda (rótulo) + cajetín + borde → excluir
        legend = None
        for kw in ("SIMBOLOG", "LEYENDA"):
            for (_i, t, x, y) in words:
                if kw in t.upper():
                    legend = (max(0, x - 0.015), max(0, y - 0.02),
                              min(1, x + PARAMS["legend_w"]), min(1, y + PARAMS["legend_h"]))
                    break
            if legend:
                break

        def excluded(x, y):
            if x >= PARAMS["titleblock_x"]:
                return True
            if x < PARAMS["border_corner"] and y < PARAMS["border_corner"]:
                return True
            if legend and legend[0] <= x <= legend[2] and legend[1] <= y <= legend[3]:
                return True
            return False

        sym_map = {s.symbol.upper(): s.element_key for s in symbols if s.symbol}
        # Un círculo-detector SIN letra cercana NO se asume de ningún tipo: se
        # reporta sin clasificar (confianza media) para que el ingeniero lo
        # resuelva. Asignar un tipo por defecto es equivocarse con confianza.
        UNCLASSIFIED = "detector_sin_clasificar"
        xbox_key = next(
            (s.element_key for s in symbols if "estrob" in s.name.lower() or "bocina" in s.name.lower()),
            "bocina_estrobo",
        )

        # Letras de detector = símbolos de 1 carácter (P/R/V/G). Las etiquetas
        # multi-carácter (ACI, E-1, MZ) NO compiten por círculos: van por texto.
        short_hits = [(i, t.upper(), x, y) for (i, t, x, y) in words
                      if t.upper() in sym_map and len(t) == 1 and not excluded(x, y)]

        detections: list[Detection] = []
        n_alta = n_media = 0
        consumed: set[int] = set()   # índices de token usados por un círculo
        circle_symbols: set[str] = set()  # símbolos que SON detectores (círculo+letra)

        # ── Círculos-detector: firma + tamaño moda + letra cercana ──
        circ = [c for c in _circles(drawings, T) if not excluded(c[0], c[1])]
        if circ:
            mode_size, _ = collections.Counter(c[2] for c in circ).most_common(1)[0]
            tol = mode_size * PARAMS["size_tol"]
            det = _dedup_norm([c for c in circ if abs(c[2] - mode_size) <= tol])
            for (cx, cy, _s) in det:
                best = (None, PARAMS["letter_dist"], -1)
                for (i, up, lx, ly) in short_hits:
                    if i in consumed:
                        continue
                    dd = math.hypot(cx - lx, cy - ly)
                    if dd < best[1]:
                        best = (up, dd, i)
                if best[0]:
                    consumed.add(best[2])
                    circle_symbols.add(best[0])
                    detections.append(Detection(
                        element_key=sym_map[best[0]], x=cx, y=cy, confidence="alta", method="geometria",
                        signature=Signature(kind="circulo", token=best[0], size=mode_size),
                    ))
                    n_alta += 1
                else:
                    detections.append(Detection(
                        element_key=UNCLASSIFIED, x=cx, y=cy, confidence="media", method="geometria",
                        signature=Signature(kind="circulo", token=None, size=mode_size),
                    ))
                    n_media += 1

        # ── Cajas-con-X (bocina/estrobo) ── (ya dedupeadas en _xboxes)
        for (cx, cy) in _xboxes(drawings, T):
            if excluded(cx, cy):
                continue
            detections.append(Detection(
                element_key=xbox_key, x=cx, y=cy, confidence="media", method="geometria",
                signature=Signature(kind="caja_x"),
            ))
            n_media += 1

        # ── Etiquetas de texto puras: tokens que casan con un símbolo que NO
        # es de círculo (extintores, gas, ACI, módulos). Los símbolos que ya
        # son detectores (P/R/V…) NO se recuentan por texto. ──
        for (i, t, x, y) in words:
            up = t.upper()
            if (
                up in sym_map
                and up not in circle_symbols
                and i not in consumed
                and len(t) <= PARAMS["text_max_len"]
                and not excluded(x, y)
            ):
                detections.append(Detection(
                    element_key=sym_map[up], x=x, y=y, confidence="alta", method="texto",
                    signature=Signature(kind="texto", token=up),
                ))
                n_alta += 1

        is_vector = char_count > 40 or len(circ) > 20
        return AnalyzeResult(
            detections=detections,
            is_vector=is_vector,
            page_width=PW,
            page_height=PH,
            stats={
                "words": len(words),
                "circles": len(circ),
                "confianza_alta": n_alta,
                "confianza_media": n_media,
                "detections": len(detections),
            },
        )
    finally:
        doc.close()
