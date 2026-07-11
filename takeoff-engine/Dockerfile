# Motor de conteo de planos (Takeoff) — PyMuPDF + FastAPI.
FROM python:3.12-slim

# libs de sistema que PyMuPDF/render pueden requerir
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Railway/Fly inyectan PORT; default 8080 para local.
ENV PORT=8080
EXPOSE 8080

# 1 worker: el estado de los jobs vive en memoria del proceso (cola interna).
# Para escalar horizontal, mover el job store a Redis/DB (hoy no hace falta).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
