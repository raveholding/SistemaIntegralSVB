from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variables de entorno del servicio de alertas."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str          # sólo vive en este servicio (nunca en el navegador)
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""       # header X-Telegram-Bot-Api-Secret-Token
    app_base_url: str = "https://svb.vincular.business"
    watchdog_interval_s: int = 30
    contracts_interval_s: int = 3600
    max_payload_bytes: int = 16_384


settings = Settings()  # type: ignore[call-arg]
