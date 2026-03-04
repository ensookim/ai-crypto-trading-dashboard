import logging
from dataclasses import dataclass
from typing import List, Tuple

import numpy as np

try:
    import pyupbit
except Exception:  # pragma: no cover
    pyupbit = None

log = logging.getLogger(__name__)

@dataclass
class InferenceResult:
    predicted_prices: List[float]
    chart_data: List[dict]

class InferenceSystem:
    def __init__(self, market: str, candle_unit: str = "minute1", history_points: int = 512, horizon: int = 60):
        self.market = market
        self.candle_unit = candle_unit
        self.history_points = history_points
        self.horizon = horizon

    def _fetch_history(self) -> Tuple[np.ndarray, List[dict]]:
        if pyupbit is None:
            raise RuntimeError("pyupbit is not installed")

        df = pyupbit.get_ohlcv(self.market, interval=self.candle_unit, count=self.history_points)
        if df is None or df.empty:
            raise RuntimeError("Failed to fetch OHLCV")
        # chartData for frontend: { time, close }
        chart_data = [{"time": str(idx), "price": float(row["close"])} for idx, row in df.iterrows()]
        closes = df["close"].astype(float).to_numpy()
        return closes, chart_data

    def inference(self) -> InferenceResult:
        closes, chart_data = self._fetch_history()

        # NOTE: original project used a torch model. For a repo-friendly default,
        # we do a simple baseline forecast: last value + small random walk (deterministic seed).
        last = float(closes[-1])
        rng = np.random.default_rng(42)
        steps = rng.normal(loc=0.0, scale=max(last * 0.0005, 1.0), size=self.horizon)
        pred = np.clip(last + np.cumsum(steps), a_min=0.0, a_max=None).astype(float).tolist()
        return InferenceResult(predicted_prices=pred, chart_data=chart_data)
