import os

# Secreto compartido con Next (header X-Engine-Secret). Sin el secreto correcto,
# todo request se rechaza — el servicio no es público.
ENGINE_SECRET = os.environ.get("ENGINE_SECRET", "")

# Descarga de imágenes (fotos, firmas, logo) por URL.
DOWNLOAD_TIMEOUT = float(os.environ.get("DOWNLOAD_TIMEOUT", "30"))
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(15 * 1024 * 1024)))
MAX_IMAGES = int(os.environ.get("MAX_IMAGES", "80"))

# Timeout de la compilación de Typst (segundos).
COMPILE_TIMEOUT = float(os.environ.get("COMPILE_TIMEOUT", "60"))
