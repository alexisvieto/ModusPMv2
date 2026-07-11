import asyncio
import uuid
from typing import Awaitable, Callable, Optional

from .schemas import AnalyzeResult, Job

# Cola interna en memoria: el endpoint recibe el trabajo y responde de
# inmediato con job_id; el procesamiento corre en background y el progreso
# se consulta por /jobs/{id}. (1 proceso/worker; para escala horizontal,
# mover este store a Redis/DB.)


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}

    def create(self) -> Job:
        job = Job(id=str(uuid.uuid4()), status="encolado")
        self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def set_progress(self, job_id: str, progress: str) -> None:
        job = self._jobs.get(job_id)
        if job:
            job.status = "procesando"
            job.progress = progress

    def finish(self, job_id: str, result: AnalyzeResult) -> None:
        job = self._jobs.get(job_id)
        if job:
            job.status = "listo"
            job.result = result
            job.progress = None

    def fail(self, job_id: str, error: str) -> None:
        job = self._jobs.get(job_id)
        if job:
            job.status = "error"
            job.error = error

    def spawn(self, job_id: str, work: Callable[[], Awaitable[AnalyzeResult]]) -> None:
        async def runner() -> None:
            try:
                result = await work()
                self.finish(job_id, result)
            except Exception as exc:  # noqa: BLE001 — se reporta el detalle
                self.fail(job_id, str(exc))

        asyncio.create_task(runner())


store = JobStore()
