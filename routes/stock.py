#!/usr/bin/env python3
"""
股票分析/技术指标/K线/对比/评分 路由
"""
import os
import traceback
import pandas as pd
from flask import Blueprint, jsonify, request

from routes.utils import cache_get, cache_set, CACHE_TTL, CACHE_LOCK, interpret_signals
from datetime import datetime

stock_bp = Blueprint("stock", __name__)


@stock_bp.route("/api/stock/<symbol>/analysis")
def api_stock_analysis(symbol):
    try:
        from skill_loader import get_module
        score_stock = getattr(get_module("stock-scoring"), "score_stock", None)
        get_financial_metrics = getattr(get_module("financial-data"), "get_financial_metrics", None)
        if score_stock is None or get_financial_metrics is None:
            return jsonify({"error": "所需模块未加载"}), 500
        scoring = score_stock(symbol)
        financial = get_financial_metrics(symbol)
        return jsonify({"评分": scoring, "财务": financial})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/stock/<symbol>/financial")
def api_stock_financial(symbol):
    try:
        from skill_loader import get_module
        get_financial_metrics = getattr(get_module("financial-data"), "get_financial_metrics", None)
        if get_financial_metrics is None:
            return jsonify({"error": "financial-data 模块未加载"}), 500
        data = get_financial_metrics(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/stock/<symbol>/news")
def api_stock_news_route(symbol):
    try:
        from skill_loader import get_module
        social_sentiment_analysis = getattr(get_module("social-sentiment"), "social_sentiment_analysis", None)
        if social_sentiment_analysis is None:
            return jsonify({"error": "social-sentiment 模块未加载"}), 500
        news_data = social_sentiment_analysis(symbol)
        return jsonify({"股票代码": symbol, "舆情分析": news_data})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/stock/<symbol>/income")
def api_stock_income(symbol):
    try:
        from skill_loader import get_module
        get_income_statement = getattr(get_module("financial-data"), "get_income_statement", None)
        if get_income_statement is None:
            return jsonify({"error": "financial-data 模块未加载"}), 500
        data = get_income_statement(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/stock/<symbol>/balance")
def api_stock_balance(symbol):
    try:
        from skill_loader import get_module
        get_balance_sheet = getattr(get_module("financial-data"), "get_balance_sheet", None)
        if get_balance_sheet is None:
            return jsonify({"error": "financial-data 模块未加载"}), 500
        data = get_balance_sheet(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/stock/risk")
def api_risk_metrics():
    symbol = request.args.get("symbol", "").strip()
    if not symbol:
        return jsonify({"error": "请提供股票代码"}), 400
    try:
        cache_key = f"risk_{symbol}"
        cached = cache_get(cache_key)
        if cached:
            return jsonify(cached)
        from skill_loader import get_module
        post_trade_risk_analysis = getattr(get_module("risk-control"), "post_trade_risk_analysis", None)
        if post_trade_risk_analysis is None:
            return jsonify({"error": "risk-control 模块未加载"}), 500
        data = post_trade_risk_analysis([symbol], days=250)
        cache_set(cache_key, data)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/stock/compare")
def api_compare_stocks():
    symbols = request.args.get("symbols", "").strip()
    if not symbols:
        return jsonify({"error": "请提供股票代码列表"}), 400
    try:
        from skill_loader import get_module
        compare_stocks = getattr(get_module("stock-comparison"), "compare_stocks", None)
        if compare_stocks is None:
            return jsonify({"error": "stock-comparison 模块未加载"}), 500
        data = compare_stocks(symbols)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/stock/indicators")
def api_indicators():
    symbol = request.args.get("symbol", "").strip()
    if not symbol:
        return jsonify({"error": "请提供股票代码"}), 400
    try:
        cache_key = f"indicators_{symbol}"
        cached = cache_get(cache_key)
        if cached:
            return jsonify(cached)
        from skill_loader import get_module
        mod = get_module("talib-indicator")
        if mod is None:
            return jsonify({"error": "talib-indicator 模块未加载"}), 500
        get_stock_kline = getattr(mod, "get_stock_kline", None)
        calculate_all_indicators = getattr(mod, "calculate_all_indicators", None)
        if get_stock_kline is None or calculate_all_indicators is None:
            return jsonify({"error": "talib-indicator 函数未找到"}), 500

        df = get_stock_kline(symbol, days=120)
        if df is None or df.empty:
            return jsonify({"error": "无法获取K线数据"}), 500

        indicators = calculate_all_indicators(df)
        close_list = df['收盘'].tolist()
        dates = df['日期'].tolist() if '日期' in df.columns else []
        latest_signals = interpret_signals(indicators, close_list)

        result = {
            "symbol": symbol,
            "dates": dates[-60:] if len(dates) > 60 else dates,
            "close": close_list[-60:] if len(close_list) > 60 else close_list,
            "indicators": {
                "sma_5": indicators.get('sma_5', [])[-60:] if len(indicators.get('sma_5', [])) > 60 else indicators.get('sma_5', []),
                "sma_10": indicators.get('sma_10', [])[-60:] if len(indicators.get('sma_10', [])) > 60 else indicators.get('sma_10', []),
                "sma_20": indicators.get('sma_20', [])[-60:] if len(indicators.get('sma_20', [])) > 60 else indicators.get('sma_20', []),
                "macd": indicators.get('macd', {}),
                "rsi_14": indicators.get('rsi_14', [])[-60:] if len(indicators.get('rsi_14', [])) > 60 else indicators.get('rsi_14', []),
                "bbands": indicators.get('bbands', {})
            },
            "signals": latest_signals
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/indicator/kline", methods=["POST"])
def api_indicator_kline():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        days = int(body.get("days", 250))
        start_date = body.get("start_date", "").strip()
        end_date = body.get("end_date", "").strip()

        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400

        if start_date and end_date:
            cache_key = f"kline_{symbol}_{start_date}_{end_date}"
        else:
            cache_key = f"kline_{symbol}_{days}"
        cached = cache_get(cache_key)
        if cached:
            return jsonify(cached)

        from skill_loader import get_module
        mod = get_module("talib-indicator")
        if mod is None:
            return jsonify({"error": "talib-indicator 模块未加载"}), 500
        get_stock_kline = getattr(mod, "get_stock_kline", None)
        if get_stock_kline is None:
            return jsonify({"error": "talib-indicator 函数未找到"}), 500

        if start_date and end_date:
            df = get_stock_kline(symbol, days=500)
            if df is not None and not df.empty:
                df['日期'] = pd.to_datetime(df['日期'])
                mask = (df['日期'] >= start_date) & (df['日期'] <= end_date)
                df = df[mask]
        else:
            df = get_stock_kline(symbol, days=max(days, 30))
            if df is not None and not df.empty and days < len(df):
                df = df.tail(days)
        if df is None or df.empty:
            return jsonify({"error": "无法获取K线数据"}), 500

        data_list = []
        for _, row in df.iterrows():
            data_list.append({
                "date": str(row.get('日期', '')),
                "open": float(row.get('开盘', 0)),
                "high": float(row.get('最高', 0)),
                "low": float(row.get('最低', 0)),
                "close": float(row.get('收盘', 0)),
                "volume": float(row.get('成交量', 0)),
                "amount": float(row.get('成交额', 0)) if '成交额' in row else 0
            })

        close_series = df['收盘'].astype(float)
        ma = {}
        for period in [5, 10, 20, 60]:
            ma_vals = close_series.rolling(window=period).mean().tolist()
            ma[f"ma{period}"] = [round(v, 2) if pd.notna(v) else None for v in ma_vals]

        bollinger = []
        ma20 = close_series.rolling(window=20).mean()
        std20 = close_series.rolling(window=20).std()
        for i in range(len(close_series)):
            if pd.notna(ma20.iloc[i]) and pd.notna(std20.iloc[i]):
                bollinger.append({
                    "mid": round(float(ma20.iloc[i]), 2),
                    "upper": round(float(ma20.iloc[i] + 2 * std20.iloc[i]), 2),
                    "lower": round(float(ma20.iloc[i] - 2 * std20.iloc[i]), 2)
                })
            else:
                bollinger.append({"mid": None, "upper": None, "lower": None})

        result = {"symbol": symbol, "data": data_list, "ma": ma, "bollinger": bollinger}
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/score/batch", methods=["POST"])
def api_score_batch():
    try:
        body = request.get_json()
        symbols = body.get("symbols", "")
        if not symbols:
            return jsonify({"error": "请提供股票代码列表"}), 400
        from skill_loader import get_module
        batch_score = getattr(get_module("stock-scoring"), "batch_score", None)
        if batch_score is None:
            return jsonify({"error": "stock-scoring 模块未加载"}), 500
        data = batch_score(symbols)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/position/single", methods=["POST"])
def api_position_single():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "")
        capital = float(body.get("capital", 100000))
        risk = body.get("risk", "medium")
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        calculate_single_position = getattr(get_module("position-manager"), "calculate_single_position", None)
        if calculate_single_position is None:
            return jsonify({"error": "position-manager 模块未加载"}), 500
        data = calculate_single_position(symbol, capital, risk)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@stock_bp.route("/api/position/batch", methods=["POST"])
def api_position_batch():
    try:
        body = request.get_json()
        symbols = body.get("symbols", "")
        capital = float(body.get("capital", 100000))
        risk = body.get("risk", "medium")
        if not symbols:
            return jsonify({"error": "请提供股票代码列表"}), 400
        from skill_loader import get_module
        calculate_batch_positions = getattr(get_module("position-manager"), "calculate_batch_positions", None)
        if calculate_batch_positions is None:
            return jsonify({"error": "position-manager 模块未加载"}), 500
        data = calculate_batch_positions(symbols, capital, risk)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500