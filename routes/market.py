#!/usr/bin/env python3
"""
大盘/板块/资金流向/市场宽度/股票筛选 路由
"""
import traceback
from flask import Blueprint, jsonify, request

from routes.utils import cache_get, cache_set, CACHE_TTL, MARKET_CACHE_TTL, CACHE_LOCK
from datetime import datetime

market_bp = Blueprint("market", __name__)


@market_bp.route("/api/market/trend")
def api_market_trend():
    cached = cache_get("market_trend", ttl=MARKET_CACHE_TTL)
    if cached:
        return jsonify(cached)
    try:
        from skill_loader import get_module
        get_overall_trend = getattr(get_module("market-trend"), "get_overall_trend", None)
        if get_overall_trend is None:
            return jsonify({"error": "market-trend 模块未加载"}), 500
        data = get_overall_trend()
        cache_set("market_trend", data)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/market/status")
def api_market_status():
    try:
        from data_utils import get_market_status
        data = get_market_status()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/market/news")
def api_market_news():
    cached = cache_get("market_news", ttl=MARKET_CACHE_TTL)
    if cached:
        return jsonify(cached)
    try:
        from skill_loader import get_module
        hot_stocks_discovery = getattr(get_module("social-sentiment"), "hot_stocks_discovery", None)
        if hot_stocks_discovery is None:
            return jsonify({"error": "social-sentiment 模块未加载"}), 500
        data = hot_stocks_discovery(top_n=20)
        cache_set("market_news", data)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/market/funds/northbound")
def api_northbound_funds():
    try:
        cache_key = "northbound_funds"
        cached = cache_get(cache_key)
        if cached:
            return jsonify(cached)
        from data_utils import get_northbound_funds
        data = get_northbound_funds()
        cache_set(cache_key, data)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/market/funds/industry")
def api_industry_funds():
    try:
        cache_key = "industry_funds"
        cached = cache_get(cache_key)
        if cached:
            return jsonify(cached)
        from data_utils import get_industry_funds
        data = get_industry_funds()
        cache_set(cache_key, data)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/market/funds/overview")
def api_market_overview():
    try:
        date = request.args.get("date", "").strip()
        cache_key = f"market_overview_{date}" if date else "market_overview"
        cached = cache_get(cache_key)
        if cached:
            return jsonify(cached)
        from skill_loader import get_module
        get_funds_market_overview = getattr(get_module("market-funds"), "get_market_overview", None)
        if get_funds_market_overview is None:
            return jsonify({"error": "market-funds 模块未加载"}), 500
        data = get_funds_market_overview(date=date if date else None)
        cache_set(cache_key, data)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/market/filter", methods=["POST"])
def api_filter_stocks():
    try:
        body = request.get_json() or {}
        from skill_loader import get_module
        filter_stocks = getattr(get_module("stock-filter"), "filter_stocks", None)
        if filter_stocks is None:
            return jsonify({"error": "stock-filter 模块未加载"}), 500
        data = filter_stocks(
            pe_min=body.get("pe_min"),
            pe_max=body.get("pe_max"),
            pb_min=body.get("pb_min"),
            pb_max=body.get("pb_max"),
            market_cap_min=body.get("market_cap_min"),
            market_cap_max=body.get("market_cap_max"),
            change_min=body.get("change_min"),
            change_max=body.get("change_max"),
            limit=body.get("limit", 20)
        )
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/market/breadth")
def api_market_breadth():
    try:
        date = request.args.get("date", "").strip()
        cache_key = f"market_breadth_{date}" if date else "market_breadth"
        cached = cache_get(cache_key)
        if cached:
            return jsonify(cached)
        from skill_loader import get_module
        get_market_breadth = getattr(get_module("market-breadth"), "get_market_breadth", None)
        if get_market_breadth is None:
            return jsonify({"error": "market-breadth 模块未加载"}), 500
        data = get_market_breadth(date=date if date else None)
        cache_set(cache_key, data)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/market/breadth/sector")
def api_sector_breadth():
    try:
        date = request.args.get("date", "").strip()
        if date:
            from skill_loader import get_module
            get_sector_breadth = getattr(get_module("market-breadth"), "get_sector_breadth", None)
            if get_sector_breadth is None:
                return jsonify({"error": "market-breadth 模块未加载"}), 500
            data = get_sector_breadth(date=date)
            return jsonify(data)

        cache_key = "sector_breadth"
        cached = cache_get(cache_key)
        if cached:
            return jsonify(cached)
        from skill_loader import get_module
        get_sector_breadth = getattr(get_module("market-breadth"), "get_sector_breadth", None)
        if get_sector_breadth is None:
            return jsonify({"error": "market-breadth 模块未加载"}), 500
        data = get_sector_breadth()
        cache_set(cache_key, data)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/sectors")
def api_sectors():
    try:
        from skill_loader import get_module
        get_sector_list = getattr(get_module("sector-analysis"), "get_sector_list", None)
        if get_sector_list is None:
            return jsonify({"error": "sector-analysis 模块未加载"}), 500
        data = get_sector_list()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/sectors/<name>")
def api_sector_detail(name):
    try:
        from skill_loader import get_module
        get_sector_detail = getattr(get_module("sector-analysis"), "get_sector_detail", None)
        if get_sector_detail is None:
            return jsonify({"error": "sector-analysis 模块未加载"}), 500
        data = get_sector_detail(name)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/pool")
def api_pool():
    try:
        sectors_param = request.args.get("sectors", "")
        count = int(request.args.get("count", 5))
        if sectors_param:
            sectors = [s.strip() for s in sectors_param.split(",")]
        else:
            sectors = None
        from skill_loader import get_module
        generate_pool = getattr(get_module("stock-pool"), "generate_pool", None)
        if generate_pool is None:
            return jsonify({"error": "stock-pool 模块未加载"}), 500
        data = generate_pool(sectors=sectors, count_per_sector=count)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@market_bp.route("/api/pool/sectors")
def api_pool_sectors():
    from skill_loader import get_module
    PREMIUM_STOCKS = getattr(get_module("stock-pool"), "PREMIUM_STOCKS", {})
    sectors_info = []
    for name, stocks in PREMIUM_STOCKS.items():
        sectors_info.append({
            "名称": name,
            "股票数量": len(stocks),
            "股票列表": [{"代码": s["代码"], "名称": s["名称"]} for s in stocks]
        })
    return jsonify({"板块列表": sectors_info})