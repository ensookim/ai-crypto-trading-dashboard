import os
from dataclasses import dataclass

def _getenv(name: str, default=None):
    v = os.getenv(name, default)
    return v

@dataclass(frozen=True)
class Settings:
    # Flask
    secret_key: str = _getenv("FLASK_SECRET_KEY", "change-me-in-prod")
    cors_origins: str = _getenv("CORS_ORIGINS", "http://localhost:3000")

    # Upbit
    upbit_access_key: str | None = _getenv("UPBIT_ACCESS_KEY")
    upbit_secret_key: str | None = _getenv("UPBIT_SECRET_KEY")
    market: str = _getenv("UPBIT_MARKET", "KRW-BTC")

    # Trading controls
    trade_fraction: float = float(_getenv("TRADE_FRACTION", "0.10"))  # use 10% of KRW balance
    min_trade_krw: float = float(_getenv("MIN_TRADE_KRW", "10000"))
    max_trade_krw: float = float(_getenv("MAX_TRADE_KRW", "100000"))  # safety cap for demo
    time_tolerance_sec: int = int(_getenv("TIME_TOLERANCE_SEC", "45"))  # execution window
    price_tolerance_ratio: float = float(_getenv("PRICE_TOLERANCE_RATIO", "0.01"))  # 1%

    # Inference
    model_path: str = _getenv("MODEL_PATH", "./model/model.pt")
    candle_unit: str = _getenv("CANDLE_UNIT", "minute1")
    history_points: int = int(_getenv("HISTORY_POINTS", "512"))
    prediction_horizon: int = int(_getenv("PREDICTION_HORIZON", "60"))

    # Storage
    sqlite_path: str = _getenv("SQLITE_PATH", "./data/app.db")

settings = Settings()
