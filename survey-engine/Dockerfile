# Motor de reportes de Site Survey — Typst (PDF editorial) + FastAPI.
FROM python:3.12-slim

# Utilidades para bajar Typst + tipografías corporativas para el PDF.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       curl xz-utils ca-certificates fonts-liberation fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Typst: binario OFICIAL, versión FIJADA (la revisada: v0.15.1). Sin build desde
# fuente — se baja el release firmado por el proyecto y se verifica la versión.
ARG TYPST_VERSION=0.15.1
RUN curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" -o /tmp/typst.tar.xz \
    && tar -xf /tmp/typst.tar.xz -C /tmp \
    && mv /tmp/typst-x86_64-unknown-linux-musl/typst /usr/local/bin/typst \
    && rm -rf /tmp/typst* \
    && typst --version

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
