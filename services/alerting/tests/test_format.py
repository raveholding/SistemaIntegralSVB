import os

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test")

from app.telegram import format_alert, format_contract  # noqa: E402


def test_alert_is_escaped_and_labeled():
    txt = format_alert({"event": "opened", "severity": "critical", "title": "db <prod>", "message": "cpu 95"})
    assert "🔴" in txt and "CRITICAL" in txt and "&lt;prod&gt;" in txt and "cpu 95" in txt


def test_resolved_alert_hides_message():
    txt = format_alert({"event": "resolved", "severity": "warning", "title": "x", "message": "secreto"})
    assert "RESUELTA" in txt and "secreto" not in txt


def test_contract_urgency_icon():
    assert format_contract({"code": "C1", "client_name": "A", "days_left": 7, "end_date": "2026-11-15"}).startswith("🔴")
    assert format_contract({"code": "C1", "client_name": "A", "days_left": 30, "end_date": "2026-12-08"}).startswith("🟡")
