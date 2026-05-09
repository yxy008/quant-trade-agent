#!/usr/bin/env python3
"""
共享工具函数 - 缓存、动态导入、信号解读等
"""
import os
import json
import uuid
import threading
import importlib.util
import traceback
import pandas as pd
from datetime import datetime

SKILLS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills")

CACHE = {}
CACHE_TTL = 300
MARKET_CACHE_TTL = 1800
CACHE_LOCK = threading.Lock()
PORTFOLIO_LOCK = threading.Lock()


def cache_get(key, ttl=None):
    if ttl is None:
        ttl = CACHE_TTL
    with CACHE_LOCK:
        entry = CACHE.get(key)
        if entry and (datetime.now() - entry["time"]).total_seconds() < ttl:
            return entry["data"]
    return None


def cache_set(key, data):
    with CACHE_LOCK:
        CACHE[key] = {"data": data, "time": datetime.now()}


def import_skill_module(skill_name, script_name):
    """动态导入 skill 模块（避免重复的 importlib 代码）"""
    script_path = os.path.join(SKILLS_DIR, skill_name, "scripts", script_name)
    spec = importlib.util.spec_from_file_location(f"{skill_name}_dynamic", script_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def interpret_signals(indicators, close_list):
    """解读技术指标信号"""
    signals = []

    macd_data = indicators.get('macd', {})
    macd_line = macd_data.get('macd', [])
    macd_signal = macd_data.get('macdsignal', [])
    macd_hist = macd_data.get('macdhist', [])

    if macd_line and macd_signal:
        valid_macd = [(m, s, h) for m, s, h in zip(macd_line, macd_signal, macd_hist)
                       if m is not None and s is not None and h is not None]
        if len(valid_macd) >= 2:
            last = valid_macd[-1]
            prev = valid_macd[-2]

            if last[0] > last[1]:
                if prev[0] <= prev[1]:
                    signals.append({"指标": "MACD", "信号": "金叉买入", "类型": "buy",
                                    "说明": "MACD上穿信号线，短期看涨信号"})
                elif last[2] > prev[2] and last[2] > 0:
                    signals.append({"指标": "MACD", "信号": "多头增强", "类型": "buy",
                                    "说明": "MACD红柱增长，多头力量增强"})
                elif last[2] < prev[2] and last[2] > 0:
                    signals.append({"指标": "MACD", "信号": "多头减弱", "类型": "caution",
                                    "说明": "MACD红柱缩短，上涨动能减弱"})
            else:
                if prev[0] >= prev[1]:
                    signals.append({"指标": "MACD", "信号": "死叉卖出", "类型": "sell",
                                    "说明": "MACD下穿信号线，短期看跌信号"})
                elif last[2] < prev[2] and last[2] < 0:
                    signals.append({"指标": "MACD", "信号": "空头增强", "类型": "sell",
                                    "说明": "MACD绿柱增长，空头力量增强"})

    rsi_list = indicators.get('rsi_14', [])
    valid_rsi = [r for r in rsi_list if r is not None]
    if valid_rsi:
        last_rsi = valid_rsi[-1]
        if last_rsi > 80:
            signals.append({"指标": "RSI", "信号": "超买", "类型": "sell",
                            "说明": f"RSI={last_rsi:.1f}，处于超买区域，注意回调风险"})
        elif last_rsi < 20:
            signals.append({"指标": "RSI", "信号": "超卖", "类型": "buy",
                            "说明": f"RSI={last_rsi:.1f}，处于超卖区域，可能出现反弹"})
        elif last_rsi > 70:
            signals.append({"指标": "RSI", "信号": "偏强", "类型": "caution",
                            "说明": f"RSI={last_rsi:.1f}，处于强势区域但需警惕"})
        elif last_rsi < 30:
            signals.append({"指标": "RSI", "信号": "偏弱", "类型": "caution",
                            "说明": f"RSI={last_rsi:.1f}，处于弱势区域"})
        else:
            signals.append({"指标": "RSI", "信号": "中性", "类型": "neutral",
                            "说明": f"RSI={last_rsi:.1f}，处于正常区间"})

    sma_5 = indicators.get('sma_5', [])
    sma_20 = indicators.get('sma_20', [])
    if sma_5 and sma_20 and close_list:
        valid_idx = min(len(sma_5), len(sma_20), len(close_list))
        if valid_idx >= 2:
            last_close = close_list[-1]
            last_sma5 = sma_5[-1]
            last_sma20 = sma_20[-1]

            if last_sma5 is not None and last_sma20 is not None:
                if last_sma5 > last_sma20:
                    signals.append({"指标": "均线", "信号": "多头排列", "类型": "buy",
                                    "说明": "5日均线在20日均线上方，短期趋势向好"})
                else:
                    signals.append({"指标": "均线", "信号": "空头排列", "类型": "sell",
                                    "说明": "5日均线在20日均线下方，短期趋势偏弱"})

            if last_close is not None and last_sma20 is not None:
                if last_close > last_sma20:
                    signals.append({"指标": "价格", "信号": "站上20日线", "类型": "buy",
                                    "说明": "收盘价在20日均线上方"})
                else:
                    signals.append({"指标": "价格", "信号": "跌破20日线", "类型": "sell",
                                    "说明": "收盘价在20日均线下方"})

    bbands = indicators.get('bbands', {})
    upper = bbands.get('upperband', [])
    lower = bbands.get('lowerband', [])
    middle = bbands.get('middleband', [])

    if upper and lower and close_list:
        valid_idx = min(len(upper), len(lower), len(close_list))
        if valid_idx >= 1:
            last_close = close_list[-1]
            last_upper = upper[-1]
            last_lower = lower[-1]

            if last_upper is not None and last_lower is not None and last_close is not None:
                if last_close >= last_upper:
                    signals.append({"指标": "布林带", "信号": "触及上轨", "类型": "sell",
                                    "说明": "价格触及布林带上轨，短期可能回调"})
                elif last_close <= last_lower:
                    signals.append({"指标": "布林带", "信号": "触及下轨", "类型": "buy",
                                    "说明": "价格触及布林带下轨，短期可能反弹"})

    return signals


def get_current_price(symbol):
    """获取股票当前价格"""
    try:
        from data_utils import get_realtime_quote
        quote = get_realtime_quote(symbol)
        if quote and quote.get("最新价"):
            return float(quote["最新价"])
    except Exception:
        pass

    try:
        from data_utils import get_stock_kline as dkline
        df = dkline(symbol, days=5)
        if df is not None and not df.empty:
            return float(df.iloc[-1]['收盘'])
    except Exception:
        pass

    return None


def load_portfolio():
    """从MySQL加载持仓数据"""
    from db_utils import execute_query
    try:
        rows = execute_query("SELECT * FROM holdings ORDER BY created_at DESC")
        result = []
        for r in rows:
            result.append({
                "id": r["id"],
                "symbol": r["symbol"],
                "name": r.get("name", ""),
                "buy_date": r["buy_date"],
                "buy_price": float(r["buy_price"]),
                "lots": int(r["lots"])
            })
        return result
    except Exception:
        return []