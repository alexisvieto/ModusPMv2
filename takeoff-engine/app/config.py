import os

# Secreto compartido con Next (header X-Engine-Secret). El servicio NO es
# público: sin el secreto correcto, todo request se rechaza.
ENGINE_SECRET = os.environ.get("ENGINE_SECRET", "")

# Timeout de descarga del PDF (segundos).
DOWNLOAD_TIMEOUT = float(os.environ.get("DOWNLOAD_TIMEOUT", "60"))

# Tamaño máximo del PDF a descargar (bytes). Planos reales llegan a ~20MB.
MAX_PDF_BYTES = int(os.environ.get("MAX_PDF_BYTES", str(40 * 1024 * 1024)))
