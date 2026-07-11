import httpx

from .config import DOWNLOAD_TIMEOUT, MAX_PDF_BYTES

# Los PDF SIEMPRE llegan por URL firmada de storage, nunca en el body del
# request (planos reales pesan 10-20MB; el body queda liviano).


async def download_pdf(pdf_url: str) -> bytes:
    async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
        async with client.stream("GET", pdf_url) as resp:
            resp.raise_for_status()
            chunks: list[bytes] = []
            total = 0
            async for chunk in resp.aiter_bytes():
                total += len(chunk)
                if total > MAX_PDF_BYTES:
                    raise ValueError("El PDF excede el tamaño máximo permitido.")
                chunks.append(chunk)
            return b"".join(chunks)
