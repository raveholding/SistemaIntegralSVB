"""
Servicio de alertas SVB (FastAPI)
─────────────────────────────────
• POST /v1/heartbeat          ← agentes instalados en servidores de clientes
• POST /v1/telegram/webhook   ← botones/comandos del bot de Telegram (ACK de alertas, /estado)
• GET  /healthz               ← liveness del propio servicio
• Jobs en segundo plano: watchdog de heartbeats (30 s), vencimiento de contratos (1 h),
  particiones mensuales de métricas.
Toda la lógica de reglas vive en Postgres (record_heartbeat) para ser atómica y auditable;
este servicio orquesta y notifica.
"""
from __future__ import annotations

import asyncio
import contextlib
import hmac
import logging
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Any
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from .config import settings
from .notifier import Notifier
from .supabase import Supabase, SupabaseError
from .telegram import Telegram

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("svb.alerting")


class Metrics(BaseModel):
    ts: str | None = None
    cpu_pct: float | None = Field(None, ge=0, le=100)
    mem_pct: float | None = Field(None, ge=0, le=100)
    disk_pct: float | None = Field(None, ge=0, le=100)
    latency_ms: float | None = Field(None, ge=0)
    db_connections: int | None = Field(None, ge=0)
    extra: dict[str, Any] | None = None


class Heartbeat(BaseModel):
    resource_id: UUID
    metrics: Metrics


async def watchdog_loop(app: FastAPI) -> None:
    while True:
        try:
            rows = await app.state.db.rpc("detect_missed_heartbeats")
            for r in rows or []:
                await app.state.notifier.alert_events(r["tenant_id"], [{
                    "event": "opened", "alert_id": r["alert_id"], "severity": "critical",
                    "title": f"{r['resource_name']}: sin heartbeat",
                    "message": f"Último latido: {r['last_heartbeat_at'] or 'nunca'}",
                }])
        except Exception:  # noqa: BLE001 — el loop nunca debe morir
            log.exception("watchdog falló")
        await asyncio.sleep(settings.watchdog_interval_s)


async def daily_jobs_loop(app: FastAPI) -> None:
    while True:
        try:
            rows = await app.state.db.rpc("process_contract_expirations")
            await app.state.notifier.contracts(rows or [])
            nxt = (date.today().replace(day=1) + timedelta(days=32)).replace(day=1)
            await app.state.db.rpc("ensure_metric_partition", {"p_month": nxt.isoformat()})
        except Exception:  # noqa: BLE001
            log.exception("jobs diarios fallaron")
        await asyncio.sleep(settings.contracts_interval_s)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = Supabase()
    app.state.tg = Telegram()
    app.state.notifier = Notifier(app.state.db, app.state.tg)
    tasks = [asyncio.create_task(watchdog_loop(app)), asyncio.create_task(daily_jobs_loop(app))]
    yield
    for t in tasks:
        t.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await t
    await app.state.db.close()
    await app.state.tg.close()


app = FastAPI(title="SVB Alerting", version="1.0.0", lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/heartbeat", status_code=202)
async def heartbeat(hb: Heartbeat, request: Request, authorization: str = Header(...)) -> dict[str, Any]:
    if int(request.headers.get("content-length", "0")) > settings.max_payload_bytes:
        raise HTTPException(413, "Payload demasiado grande")
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        res = await app.state.db.rpc("record_heartbeat", {
            "p_resource": str(hb.resource_id), "p_token": token,
            "p_metrics": hb.metrics.model_dump(exclude_none=True),
        })
    except SupabaseError as e:
        # 28000 = token inválido (no revelamos si el recurso existe)
        raise HTTPException(401 if "28000" in e.body or "Token" in e.body else 502, "Heartbeat rechazado") from e

    if res.get("events"):
        asyncio.create_task(app.state.notifier.alert_events(res["tenant_id"], res["events"]))
    return {"status": res["status"], "events": len(res.get("events", []))}


@app.post("/v1/telegram/webhook")
async def telegram_webhook(request: Request, x_telegram_bot_api_secret_token: str = Header("")) -> dict[str, bool]:
    if not settings.telegram_webhook_secret or not hmac.compare_digest(
        x_telegram_bot_api_secret_token, settings.telegram_webhook_secret
    ):
        raise HTTPException(403, "Firma inválida")
    update = await request.json()

    cb = update.get("callback_query")
    if cb and str(cb.get("data", "")).startswith("ack:"):
        alert_id = cb["data"].split(":", 1)[1]
        who = cb.get("from", {}).get("first_name", "Telegram")
        await app.state.db.update("alerts", f"id=eq.{UUID(alert_id)}&status=eq.open", {"status": "acknowledged"})
        await app.state.tg.answer_callback(cb["id"], f"Alerta tomada por {who}")
        log.info("alerta %s ACK vía Telegram por %s", alert_id, who)

    msg = update.get("message") or {}
    if str(msg.get("text", "")).startswith("/estado"):
        rows = await app.state.db.select("monitored_resources", "select=name,status&is_active=eq.true&status=neq.operational")
        text = "✅ Todo operativo" if not rows else "\n".join(f"• {r['name']}: {r['status']}" for r in rows)
        await app.state.tg.send(str(msg["chat"]["id"]), text)
    return {"ok": True}
