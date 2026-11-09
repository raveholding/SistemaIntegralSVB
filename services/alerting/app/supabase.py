"""Cliente mínimo de PostgREST con service_role (bypassa RLS: usar sólo para jobs del backend)."""
from __future__ import annotations

from typing import Any

import httpx

from .config import settings


class Supabase:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient(
            base_url=f"{settings.supabase_url}/rest/v1",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )

    async def rpc(self, fn: str, params: dict[str, Any] | None = None) -> Any:
        r = await self._http.post(f"/rpc/{fn}", json=params or {})
        if r.status_code >= 400:
            raise SupabaseError(r.status_code, r.text)
        return r.json() if r.content else None

    async def select(self, table: str, query: str) -> list[dict[str, Any]]:
        r = await self._http.get(f"/{table}?{query}")
        r.raise_for_status()
        return r.json()

    async def update(self, table: str, query: str, values: dict[str, Any]) -> None:
        r = await self._http.patch(f"/{table}?{query}", json=values, headers={"Prefer": "return=minimal"})
        r.raise_for_status()

    async def close(self) -> None:
        await self._http.aclose()


class SupabaseError(Exception):
    def __init__(self, status: int, body: str) -> None:
        super().__init__(f"{status}: {body}")
        self.status = status
        self.body = body
