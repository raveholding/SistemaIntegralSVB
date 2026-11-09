"""Envío de alertas a Telegram (Bot API) con formato HTML y botón de acción."""
from __future__ import annotations

import html
from typing import Any

import httpx

from .config import settings

SEVERITY_ICON = {"critical": "🔴", "warning": "🟡", "info": "🔵"}
SEVERITY_RANK = {"info": 0, "warning": 1, "critical": 2}


def format_alert(event: dict[str, Any], tenant_name: str | None = None) -> str:
    """Mensaje legible en el celular: estado, título, detalle y enlace al monitor."""
    resolved = event.get("event") == "resolved"
    icon = "✅" if resolved else SEVERITY_ICON.get(event.get("severity", "info"), "⚪")
    head = "RESUELTA" if resolved else event.get("severity", "info").upper()
    lines = [f"{icon} <b>{head}</b> · {html.escape(event.get('title', 'Alerta'))}"]
    if event.get("message") and not resolved:
        lines.append(html.escape(event["message"]))
    if tenant_name:
        lines.append(f"<i>{html.escape(tenant_name)}</i>")
    lines.append(f'<a href="{settings.app_base_url}/monitor">Abrir monitor</a>')
    return "\n".join(lines)


def format_contract(row: dict[str, Any]) -> str:
    d = row["days_left"]
    icon = "🔴" if d <= 7 else "🟡"
    return (
        f"{icon} <b>Contrato por vencer</b> · {html.escape(row['code'])}\n"
        f"{html.escape(row['client_name'])} — vence en <b>{d} días</b> ({row['end_date']})\n"
        f'<a href="{settings.app_base_url}/documentos">Ver contratos</a>'
    )


class Telegram:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient(base_url=f"https://api.telegram.org/bot{settings.telegram_bot_token}", timeout=10)

    @property
    def enabled(self) -> bool:
        return bool(settings.telegram_bot_token)

    async def send(self, chat_id: str, text: str, alert_id: str | None = None) -> int | None:
        if not self.enabled:
            return None
        payload: dict[str, Any] = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
        if alert_id:
            payload["reply_markup"] = {"inline_keyboard": [[{"text": "🛠 Tomar alerta", "callback_data": f"ack:{alert_id}"}]]}
        r = await self._http.post("/sendMessage", json=payload)
        if r.status_code != 200:
            return None
        return r.json().get("result", {}).get("message_id")

    async def answer_callback(self, callback_id: str, text: str) -> None:
        if self.enabled:
            await self._http.post("/answerCallbackQuery", json={"callback_query_id": callback_id, "text": text})

    async def close(self) -> None:
        await self._http.aclose()
