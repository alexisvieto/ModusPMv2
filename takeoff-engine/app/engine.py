"""
Motor de conteo de planos — Ruta A (vectorial), determinístico.

Validado contra ACI-03 (Riga/Hotel Escuela): los detectores etiquetados dan
exacto (P=65 humo, R=5 calor, V=5 calor) por firma geométrica + validación
cruzada con la letra. Filosofía: el motor NO se equivoca con confianza alta;
lo dudoso va con confianza media/baja para que el humano lo verifique.

Método:
  1. Espacio de trabajo = el del pixmap del visor (page.rotation_matrix
     aplicado y normalizado por las dimensiones del render). Así el conteo,
     las zonas y el overlay comparten un único sistema de coordenadas 0-1.
  2. Círculos-detector: firma = path con >=3 curvas Bézier y aspecto ~1:1;
     el TAMAÑO se aprende como la MODA de la distribución (los dispositivos
     repetidos forman el cluster dominante) — no se hardcodea.
  3. Clasificación por la LETRA cercana (P/R/V/…): la letra se mapea a
     element_key con el diccionario de la leyenda (leído por visión en Next).
     Círculo + letra = confianza ALTA; círculo sin letra = confianza MEDIA.
  4. Cajas-con-X (bocina/estrobo): cuadro + 2 diagonales centradas, criterio
     estricto (precisión sobre recall; el recall se sube en iteración 2 con
     clustering de paths fragmentados).
  5. Etiquetas-símbolo directas (MX, AS, PANEL…): tokens de texto que casan
     con un símbolo del diccionario.
  6. Exclusión de zonas: leyenda (por rótulo) y cajetín.

Interfaz pura (sin UI):  count(pdf_bytes, system_type, symbols) → AnalyzeResult
"""
from __future__ import annotations

import collections
import math

import fitz  # PyMuPDF

from .schemas import AnalyzeResult, Detection, Symbol

PARAMS = {
    "circle_curves_min": 3,      # curvas Bézier mínimas para "círculo"
    "circle_ratio": (0.7, 1.4),  # aspecto de un círculo
    "circle_size_min_pt": 5,     # rango bruto donde buscar la moda del detector
    "circle_size_max_pt": 30,
    "size_tol": 0.10,            # ±10% alrededor de la moda
    "dedup_dist": 0.002,         # coords normalizadas: mismo símbolo si más cerca
    "letter_dist": 0.013,        # distancia máx círculo↔letra (norm)
    "xbox_size_pt": (9, 26),     # lado de una caja-con-X
    "xbox_ratio": (0.75, 1.33),
    "text_max_len": 12,
    "legend_w": 0.20,            # tamaño del bloque de leyenda alrededor del rótulo
    "legend_h": 0.24,
    "titleblock_frac": 0.14,     # franja del cajetín (se excluye)
}


def _learn_transform(page: "fitz.Page"):
    """Devuelve (T, PW, PH): T(x,y)→(nx,ny) en el espacio del pixmap del visor."""
    pm = page.get_pixmap(matrix=fitz.Matrix(1, 1))
    PW, PH = float(pm.width), float(pm.height)
    rot = page.rotation_matrix

    def T(x: float, y: float):
        q = fitz.Point(x, y) * rot
        return q.x / PW, q.y / PH

    return T, PW, PH


def _circles(page, T):
    """Círculos (firma + centro normalizado + tamaño en pt)."""
    lo, hi = PARAMS["circle_size_min_pt"], PARAMS["circle_size_max_pt"]
    rmin, rmax = PARAMS["circle_ratio"]
    out = []
    for d in page.get_drawings():
        r = d.get("rect")
        if not r:
            continue
        nc = sum(1 for it in d.get("items", []) if it and it[0] == "c")
        w_, h_ = abs(r.x1 - r.x0), abs(r.y1 - r.y0)
        if nc >= PARAMS["circle_curves_min"] and h_ > 0 and rmin < w_ / h_ < rmax and lo <= w_ <= hi:
            cx, cy = T((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
            out.append((cx, cy, round(w_, 1)))
    return out


def _xboxes(page, T):
    """Cajas-con-X: cuadro + 2 diagonales centradas (criterio estricto)."""
    lo, hi = PARAMS["xbox_size_pt"]
    rmin, rmax = PARAMS["xbox_ratio"]
    out = []
    for d in page.get_drawings():
        r = d.get("rect")
        if not r:
            continue
        w_, h_ = abs(r.x1 - r.x0), abs(r.y1 - r.y0)
        if not (lo <= w_ <= hi and lo <= h_ <= hi and rmin < (w_ / h_ if h_ else 9) < rmax):
            continue
        cx0, cy0 = (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2
        diag = border = 0
        for it in d.get("items", []):
            if not it:
                continue
            if it[0] == "re":
                border += 4
            elif it[0] == "l":
                a, b = it[1], it[2]
                dx, dy = b.x - a.x, b.y - a.y
                L = math.hypot(dx, dy)
                if L < 5:
                    continue
                ang = abs(math.degrees(math.atan2(dy, dx))) % 90
                mx, my = (a.x + b.x) / 2, (a.y + b.y) / 2
                if 32 < ang < 58 and math.hypot(mx - cx0, my - cy0) < w_ * 0.35:
                    diag += 1
                elif ang < 12 or ang > 78:
                    border += 1
        if diag >= 2 and border >= 3:
            out.append((*T(cx0, cy0), round(w_, 1)))
    return out


def _dedup(points):
    uniq = []
    for c in points:
        if not any(math.hypot(c[0] - u[0], c[1] - u[1]) < PARAMS["dedup_dist"] for u in uniq):
            uniq.append(c)
    return uniq


def count(pdf_bytes: bytes, system_type: str, symbols: list[Symbol], page_index: int = 0) -> AnalyzeResult:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc.load_page(page_index)
        T, PW, PH = _learn_transform(page)

        # Texto en espacio del visor
        words = []
        char_count = 0
        for w in page.get_text("words"):
            t = str(w[4]).strip()
            char_count += len(t)
            if not t:
                continue
            x, y = T((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
            words.append((t, x, y))

        # Zona de leyenda (por rótulo) y cajetín → excluir
        legend = None
        for kw in ("SIMBOLOG", "LEYENDA"):
            for (t, x, y) in words:
                if kw in t.upper():
                    legend = (
                        max(0, x - 0.015),
                        max(0, y - 0.02),
                        min(1, x + PARAMS["legend_w"]),
                        min(1, y + PARAMS["legend_h"]),
                    )
                    break
            if legend:
                break

        def excluded(x, y):
            if x >= 1 - PARAMS["titleblock_frac"]:
                return True
            if legend and legend[0] <= x <= legend[2] and legend[1] <= y <= legend[3]:
                return True
            return False

        # Diccionario de la leyenda (visión): letra/símbolo → element_key
        sym_map = {s.symbol.upper(): s.element_key for s in symbols if s.symbol}
        # element_key por defecto para un círculo sin letra: el símbolo de la
        # leyenda cuya descripción sugiere "detector" de un tipo genérico.
        default_circle = next(
            (s.element_key for s in symbols if "humo" in s.name.lower()),
            "detector_humo",
        )
        # Letras presentes que mapean a algún elemento (para clasificar círculos)
        letter_pts: dict[str, list[tuple[float, float]]] = collections.defaultdict(list)
        for (t, x, y) in words:
            up = t.upper()
            if up in sym_map and len(up) <= 3 and not excluded(x, y):
                letter_pts[up].append((x, y))

        def nearest_letter(cx, cy):
            best, bd = None, PARAMS["letter_dist"]
            for up, pts in letter_pts.items():
                for (lx, ly) in pts:
                    d = math.hypot(cx - lx, cy - ly)
                    if d < bd:
                        best, bd = up, d
            return best

        detections: list[Detection] = []
        n_alta = n_media = 0

        # ── Círculos-detector ──
        circ = [c for c in _circles(page, T) if not excluded(c[0], c[1])]
        if circ:
            mode_size, _ = collections.Counter(c[2] for c in circ).most_common(1)[0]
            tol = mode_size * PARAMS["size_tol"]
            det = _dedup([c for c in circ if abs(c[2] - mode_size) <= tol])
            for (cx, cy, _s) in det:
                letter = nearest_letter(cx, cy)
                if letter:
                    detections.append(Detection(element_key=sym_map[letter], x=cx, y=cy, confidence="alta", method="geometria"))
                    n_alta += 1
                else:
                    detections.append(Detection(element_key=default_circle, x=cx, y=cy, confidence="media", method="geometria"))
                    n_media += 1

        # ── Cajas-con-X (bocina/estrobo) ──
        xbox_key = next(
            (s.element_key for s in symbols if "estrob" in s.name.lower() or "bocina" in s.name.lower()),
            "bocina_estrobo",
        )
        for (cx, cy, _s) in _dedup(_xboxes(page, T)):
            if excluded(cx, cy):
                continue
            detections.append(Detection(element_key=xbox_key, x=cx, y=cy, confidence="media", method="geometria"))
            n_media += 1

        # ── Etiquetas-símbolo directas (texto que ES un símbolo del catálogo y
        # no fue ya consumido como letra de un círculo): p.ej. MX, AS, PANEL. ──
        used_letters = set(letter_pts.keys())
        for (t, x, y) in words:
            up = t.upper()
            if up in sym_map and up not in used_letters and len(t) <= PARAMS["text_max_len"] and not excluded(x, y):
                detections.append(Detection(element_key=sym_map[up], x=x, y=y, confidence="media", method="texto"))
                n_media += 1

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
