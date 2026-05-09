#!/usr/bin/env python3
"""
持仓管理/策略组合管理 路由
"""
import uuid
import traceback
from flask import Blueprint, jsonify, request

from routes.utils import cache_get, cache_set, CACHE_TTL, CACHE_LOCK, PORTFOLIO_LOCK, get_current_price, load_portfolio
from datetime import datetime

portfolio_bp = Blueprint("portfolio", __name__)


@portfolio_bp.route("/api/portfolio", methods=["GET"])
def api_portfolio_list():
    try:
        holdings = load_portfolio()
        result = []
        total_cost = 0
        total_current = 0

        for h in holdings:
            symbol = h.get("symbol", "")
            current_price = get_current_price(symbol)
            buy_price = float(h.get("buy_price", 0))
            lots = int(h.get("lots", 0))
            shares = lots * 100
            cost = buy_price * shares

            profit = 0
            profit_pct = 0
            if current_price is not None and current_price > 0 and buy_price > 0:
                current_value = current_price * shares
                profit = current_value - cost
                profit_pct = (current_price / buy_price - 1) * 100
                total_current += current_value
            else:
                current_value = cost
                total_current += cost

            total_cost += cost

            result.append({
                "id": h.get("id", ""),
                "symbol": symbol,
                "name": h.get("name", ""),
                "buy_date": h.get("buy_date", ""),
                "buy_price": buy_price,
                "lots": lots,
                "shares": shares,
                "cost": round(cost, 2),
                "current_price": round(current_price, 2) if current_price else None,
                "current_value": round(current_value, 2),
                "profit": round(profit, 2),
                "profit_pct": round(profit_pct, 2)
            })

        total_profit = total_current - total_cost
        total_profit_pct = (total_current / total_cost - 1) * 100 if total_cost > 0 else 0

        return jsonify({
            "持仓列表": result,
            "总成本": round(total_cost, 2),
            "总市值": round(total_current, 2),
            "总盈亏": round(total_profit, 2),
            "总盈亏比例": round(total_profit_pct, 2),
            "持仓数量": len(result)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@portfolio_bp.route("/api/portfolio/add", methods=["POST"])
def api_portfolio_add():
    try:
        from db_utils import execute_update
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        buy_date = body.get("buy_date", "").strip()
        buy_price = float(body.get("buy_price", 0))
        lots = int(body.get("lots", 0))

        if not symbol or len(symbol) != 6:
            return jsonify({"error": "请输入正确的6位股票代码"}), 400
        if not buy_date:
            return jsonify({"error": "请输入购买日期"}), 400
        if buy_price <= 0:
            return jsonify({"error": "请输入有效的购买单价"}), 400
        if lots <= 0:
            return jsonify({"error": "请输入有效的购买手数"}), 400

        name = symbol
        try:
            import akshare as ak
            df_list = ak.stock_zh_a_spot_em()
            filtered = df_list[df_list['代码'] == symbol]
            if not filtered.empty:
                name = str(filtered.iloc[0]['名称'])
        except Exception:
            pass

        with PORTFOLIO_LOCK:
            holding_id = str(uuid.uuid4())[:8]
            execute_update(
                "INSERT INTO holdings (id, symbol, name, buy_date, buy_price, lots) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (holding_id, symbol, name, buy_date, buy_price, lots)
            )
            holding = {
                "id": holding_id,
                "symbol": symbol,
                "name": name,
                "buy_date": buy_date,
                "buy_price": buy_price,
                "lots": lots
            }

        return jsonify({"status": "ok", "holding": holding})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@portfolio_bp.route("/api/portfolio/<holding_id>", methods=["DELETE"])
def api_portfolio_delete(holding_id):
    try:
        from db_utils import execute_update
        with PORTFOLIO_LOCK:
            execute_update("DELETE FROM holdings WHERE id = %s", (holding_id,))
        return jsonify({"status": "ok"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@portfolio_bp.route("/api/portfolio/analysis", methods=["GET"])
def api_portfolio_analysis():
    try:
        holdings = load_portfolio()
        if not holdings:
            return jsonify({"分析结果": [], "提示": "暂无持仓数据"})

        from skill_loader import get_module
        score_stock = getattr(get_module("stock-scoring"), "score_stock", None)

        results = []
        for h in holdings:
            symbol = h.get("symbol", "")
            buy_price = float(h.get("buy_price", 0))
            lots = int(h.get("lots", 0))
            shares = lots * 100
            cost = buy_price * shares

            scoring = None
            try:
                if score_stock:
                    scoring = score_stock(symbol)
            except Exception:
                pass

            current_price = get_current_price(symbol)
            profit_pct = 0
            if current_price and buy_price > 0:
                profit_pct = (current_price / buy_price - 1) * 100

            total_score = scoring["总分"] if scoring else 0
            suggestion = scoring["建议"] if scoring else "无法评分"

            if total_score >= 80:
                hold_suggestion = "强烈建议继续持有"
                hold_reason = "综合评分优秀，技术面和基本面均表现良好"
                sell_suggestion = "暂不建议卖出"
            elif total_score >= 70:
                if profit_pct > 20:
                    hold_suggestion = "可继续持有，但注意止盈"
                    hold_reason = "评分良好但已有较大涨幅，建议设置止盈位"
                    sell_suggestion = "可考虑分批止盈，锁定部分利润"
                else:
                    hold_suggestion = "建议继续持有"
                    hold_reason = "综合评分良好，仍有上涨空间"
                    sell_suggestion = "暂不建议卖出"
            elif total_score >= 60:
                if profit_pct > 15:
                    hold_suggestion = "谨慎持有，考虑减仓"
                    hold_reason = "评分一般且已有一定涨幅"
                    sell_suggestion = "建议适当减仓，降低风险"
                elif profit_pct < -10:
                    hold_suggestion = "谨慎持有，关注止损"
                    hold_reason = "评分一般且已出现较大亏损"
                    sell_suggestion = "若跌破关键支撑位建议止损"
                else:
                    hold_suggestion = "观望持有"
                    hold_reason = "评分一般，方向不明确"
                    sell_suggestion = "可暂时持有观察"
            else:
                if profit_pct > 0:
                    hold_suggestion = "建议卖出"
                    hold_reason = "评分较低，建议获利了结"
                    sell_suggestion = "建议卖出，锁定利润"
                else:
                    hold_suggestion = "建议止损卖出"
                    hold_reason = "评分较低，继续持有可能扩大亏损"
                    sell_suggestion = "建议止损卖出，控制风险"

            results.append({
                "id": h.get("id", ""),
                "symbol": symbol,
                "name": h.get("name", ""),
                "buy_date": h.get("buy_date", ""),
                "buy_price": buy_price,
                "lots": lots,
                "shares": shares,
                "cost": round(cost, 2),
                "current_price": round(current_price, 2) if current_price else None,
                "profit_pct": round(profit_pct, 2),
                "score": total_score,
                "score_suggestion": suggestion,
                "hold_suggestion": hold_suggestion,
                "hold_reason": hold_reason,
                "sell_suggestion": sell_suggestion
            })

        return jsonify({"分析结果": results, "分析数量": len(results)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@portfolio_bp.route("/api/portfolio/create", methods=["POST"])
def api_portfolio_create():
    try:
        body = request.get_json()
        name = body.get("name", "").strip()
        strategies = body.get("strategies", [])
        capital = float(body.get("capital", 1000000))
        if not name:
            return jsonify({"error": "请提供组合名称"}), 400
        if not strategies:
            return jsonify({"error": "请提供策略列表"}), 400
        from routes.utils import import_skill_module
        pf_module = import_skill_module("portfolio-mgmt", "portfolio_cli.py")
        result = pf_module.create_portfolio(name, strategies, capital)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@portfolio_bp.route("/api/portfolio/allocate", methods=["POST"])
def api_portfolio_allocate():
    try:
        body = request.get_json()
        method = body.get("method", "equal")
        data = body.get("data", [])
        capital = float(body.get("capital", 1000000))
        if not data:
            return jsonify({"error": "请提供策略数据"}), 400
        from routes.utils import import_skill_module
        pf_module = import_skill_module("portfolio-mgmt", "portfolio_cli.py")
        result = pf_module.allocate_capital(method, data, capital)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@portfolio_bp.route("/api/portfolio/backtest", methods=["POST"])
def api_portfolio_backtest():
    try:
        body = request.get_json()
        data = body.get("data", [])
        capital = float(body.get("capital", 1000000))
        if not data:
            return jsonify({"error": "请提供策略数据"}), 400
        from routes.utils import import_skill_module
        pf_module = import_skill_module("portfolio-mgmt", "portfolio_cli.py")
        result = pf_module.backtest_portfolio(data, capital)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@portfolio_bp.route("/api/portfolio/optimize", methods=["POST"])
def api_portfolio_optimize():
    try:
        body = request.get_json()
        symbols = body.get("symbols", [])
        capital = float(body.get("capital", 100000))
        days = int(body.get("days", 250))
        if not symbols or len(symbols) < 2:
            return jsonify({"error": "至少需要2只股票"}), 400
        from skill_loader import get_module
        mean_variance_optimization = getattr(get_module("mean-variance"), "mean_variance_optimization", None)
        if mean_variance_optimization is None:
            return jsonify({"error": "mean-variance 模块未加载"}), 500
        data = mean_variance_optimization(symbols[0], symbols, days=days, initial_capital=capital)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500