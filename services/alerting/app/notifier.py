"""Despacho de eventos a los canales de notificación configurados por tenant."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from .supabase import Supabase
from .telegram import SEVERITY_RANK, Telegram, format_alert, format_contract

log = logging.getLogger("svb.notifier")


class Notifier:
    def __init__(self, db: Supabase, tg: Telegram) -> None:
        self.db = db
        self.tg = tg

    async def _channels(self, tenant_id: str) -> list[dict[str, Any]]:
        return await self.db.select(
            "notification_channels",
            f"select=id,kind,config,min_severity&tenant_id=eq.{tenant_id}&is_active=eq.true&kind=eq.telegram",
        )

    async def alert_events(self, tenant_id: str, events: list[dict[str, Any]]) -> None:
        if not events:
            return
        channels = await self._channels(tenant_id)
        for ev in events:
            sev = SEVERITY_RANK.get(ev.get("severity", "info"), 0)
            text = format_alert(ev)
            sent = None
            for ch in channels:
                if sev < SEVERITY_RANK.get(ch["min_severity"], 1):
                    continue
                chat = ch["config"].get("chat_id")
                if chat:
                    sent = await self.tg.send(chat, text, ev["alert_id"] if ev.get("event") == "opened" else None) or sent
            if ev.get("event") == "opened":
                await self.db.update(
                    "alerts", f"id=eq.{ev['alert_id']}",
                    {"notified_at": datetime.now(timezone.utc).isoformat(), "telegram_msg_id": sent},
                )
            log.info("alerta %s %s notificada (%s canales)", ev.get("event"), ev.get("alert_id"), len(channels))

    async def contracts(self, rows: list[dict[str, Any]]) -> None:
        by_tenant: dict[str, list[dict[str, Any]]] = {}
        for r in rows:
            by_tenant.setdefault(r["tenant_id"], []).append(r)
        for tenant_id, items in by_tenant.items():
            for ch in await self._channels(tenant_id):
                chat = ch["config"].get("chat_id")
                for r in items:
                    if chat:
                        await self.tg.send(chat, format_contract(r))
