import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple

import pytz
import pyupbit

from backend.config import settings
from backend.inference.inference_system import InferenceSystem

log = logging.getLogger(__name__)

KST = pytz.timezone("Asia/Seoul")

@dataclass
class ScheduledOrder:
    side: str  # 'buy' or 'sell'
    expected_price: float
    execute_at: datetime  # timezone-aware (KST)

class TradingBot:
    def __init__(self):
        if not settings.upbit_access_key or not settings.upbit_secret_key:
            raise RuntimeError("UPBIT_ACCESS_KEY/UPBIT_SECRET_KEY are required (set env vars).")

        self.market = settings.market
        self.upbit = pyupbit.Upbit(settings.upbit_access_key, settings.upbit_secret_key)
        self.fee_rate = 0.0005
        self.inference = InferenceSystem(
            market=self.market,
            candle_unit=settings.candle_unit,
            history_points=settings.history_points,
            horizon=settings.prediction_horizon,
        )

        self.scheduled: List[ScheduledOrder] = []

    # ---------- strategy helpers ----------
    def _best_buy_sell(self, preds: List[float]) -> Optional[Tuple[int, int, float]]:
        """Return (buy_idx, sell_idx, best_profit_per_unit) maximizing preds[j]-preds[i] with i<j."""
        if not preds or len(preds) < 2:
            return None
        min_price = preds[0]
        min_idx = 0
        best = (0, 1, preds[1] - preds[0])
        for j in range(1, len(preds)):
            profit = preds[j] - min_price
            if profit > best[2]:
                best = (min_idx, j, profit)
            if preds[j] < min_price:
                min_price = preds[j]
                min_idx = j
        if best[2] <= 0:
            return None
        return best

    def _now_kst_minute(self) -> datetime:
        return datetime.now(KST).replace(second=0, microsecond=0)

    # ---------- trading ops ----------
    def _position_size_krw(self) -> float:
        krw = float(self.upbit.get_balance("KRW") or 0.0)
        amt = krw * settings.trade_fraction
        amt = max(amt, settings.min_trade_krw)
        amt = min(amt, settings.max_trade_krw)
        # Upbit requires min order sizes; keep integer KRW
        return float(int(amt))

    def _price_ok(self, expected: float, current: float) -> bool:
        tol = max(expected * settings.price_tolerance_ratio, 1.0)
        return abs(expected - current) <= tol

    def _schedule_orders(self, preds: List[float]) -> float:
        plan = self._best_buy_sell(preds)
        if plan is None:
            self.scheduled = []
            return 0.0

        buy_idx, sell_idx, _ = plan
        buy_price = float(preds[buy_idx])
        sell_price = float(preds[sell_idx])

        buy_fee = buy_price * self.fee_rate
        sell_fee = sell_price * self.fee_rate
        expected_buy = buy_price + buy_fee
        expected_sell = sell_price - sell_fee

        position_krw = self._position_size_krw()
        expected_profit = (expected_sell - expected_buy) * (position_krw / expected_buy)

        if expected_profit <= 0:
            self.scheduled = []
            return 0.0

        base_time = self._now_kst_minute()
        buy_time = base_time + timedelta(minutes=max(buy_idx - 1, 0))
        sell_time = base_time + timedelta(minutes=max(sell_idx - 1, 0))

        self.scheduled = [
            ScheduledOrder("buy", buy_price, buy_time),
            ScheduledOrder("sell", sell_price, sell_time),
        ]
        return float(expected_profit)

    def _execute_due_orders(self, current_price: float) -> None:
        if not self.scheduled:
            return

        now = datetime.now(KST)
        remaining: List[ScheduledOrder] = []

        for o in self.scheduled:
            delta = abs((now - o.execute_at).total_seconds())

            # 아직 실행 시간이 아니면 보류
            if delta > settings.time_tolerance_sec:
                remaining.append(o)
                continue

            if o.side == "buy":
                if not self._price_ok(o.expected_price, current_price):
                    log.warning(
                        "Buy canceled due to price deviation. expected=%.2f current=%.2f",
                        o.expected_price, current_price
                    )
                    remaining = []  # 플랜 전체 취소
                    break

                amt = self._position_size_krw()
                if amt < settings.min_trade_krw:
                    log.warning("Insufficient KRW for buy.")
                    remaining = []
                    break

                self.upbit.buy_market_order(self.market, amt)
                log.info("BUY executed: %s amount_krw=%.0f current_price=%.2f", self.market, amt, current_price)

            else:  # sell
                coin = self.market.split("-")[1]
                qty = float(self.upbit.get_balance(coin) or 0.0)
                if qty <= 0:
                    log.warning("No coin balance to sell.")
                else:
                    self.upbit.sell_market_order(self.market, qty)
                    log.info("SELL executed: %s qty=%.8f current_price=%.2f", self.market, qty, current_price)

        self.scheduled = remaining

        # ---------- reporting ----------
    def _balances(self) -> List[dict]:
        balances = self.upbit.get_balances()


        out: List[dict] = []
        for b in balances:
            if not isinstance(b, dict):
                log.warning("balance item not dict: %s", b)
                continue
            out.append({
                "currency": b.get("currency"),
                "balance": b.get("balance"),
                "avg_buy_price": b.get("avg_buy_price"),
            })
        return out

    def _order_log(self) -> List[dict]:
        order_list: List[dict] = []
        try:
            trades = self.upbit.get_order(self.market, state="done") or []
            if not isinstance(trades, list):
                log.warning("get_order returned %s: %s", type(trades), trades)
                return []

            for t in trades:
                if not isinstance(t, dict):
                    continue
                created_at = t.get("created_at")
                if not created_at:
                    continue
                dt = datetime.fromisoformat(created_at.replace("Z", "+00:00")).astimezone(KST)
                order_list.append({
                    "market": t.get("market"),
                    "side": t.get("side"),
                    "volume": t.get("volume"),
                    "paid_fee": t.get("paid_fee"),
                    "time": dt.strftime("%Y-%m-%d %H:%M:00"),
                })
        except Exception as e:
            log.warning("Failed to fetch order log: %s", e)
        return order_list

    def _profit_rate(self, current_price: float) -> List[dict]:
        res: List[dict] = []
        balances = self._balances()  # ✅ 이미 방어된 결과 사용

        coin = self.market.split("-")[1]
        for b in balances:
            if b.get("currency") != coin:
                continue

            vol = float(b.get("balance") or 0.0)
            avg = float(b.get("avg_buy_price") or 0.0)
            if vol <= 0 or avg <= 0:
                continue

            total_krw = current_price * vol
            invested = avg * vol
            res.append({
                "currency": b.get("currency"),
                "volume": vol,
                "avg_buy_price": avg,
                "total_krw": total_krw,
                "invested_krw": invested,
                "pnl_krw": total_krw - invested,
                "pnl_rate": (total_krw - invested) / invested * 100.0,
            })
        return res

    def run(self) -> Dict[str, Any]:
        current_price = float(pyupbit.get_current_price(self.market) or 0.0)

        inf = self.inference.inference()
        expected_profit = 0.0
        if not self.scheduled:
            expected_profit = self._schedule_orders(inf.predicted_prices)

        self._execute_due_orders(current_price)

        return {
            "chartData": inf.chart_data,
            "Inference_data": inf.predicted_prices,
            "expected_profit": expected_profit,
            "scheduled_orders": [
                {"type": o.side, "price": o.expected_price, "time": o.execute_at.strftime("%Y-%m-%d %H:%M:%S")}
                for o in self.scheduled
            ],
            "order_log": self._order_log(),
            "balances": self._balances(),
            "profit_rate": self._profit_rate(current_price),
        }