#!/usr/bin/env python3
"""
回测系统/策略框架/参数优化 路由
"""
import os
import traceback
from flask import Blueprint, jsonify, request

from routes.utils import import_skill_module

backtest_bp = Blueprint("backtest", __name__)
SKILLS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills")


@backtest_bp.route("/api/strategy/list")
def api_strategy_list():
    try:
        from skill_loader import get_module
        list_strategies = getattr(get_module("strategy-framework"), "list_strategies", None)
        if list_strategies is None:
            return jsonify({"error": "strategy-framework 模块未加载"}), 500
        data = list_strategies()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/strategy/signals", methods=["POST"])
def api_strategy_signals():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        strategy_id = body.get("strategy", "ma_cross").strip()
        params = body.get("params", {})
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        generate_strategy_signals = getattr(get_module("strategy-framework"), "generate_signals", None)
        if generate_strategy_signals is None:
            return jsonify({"error": "strategy-framework 模块未加载"}), 500
        data = generate_strategy_signals(symbol, strategy_id, **params)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/run", methods=["POST"])
def api_backtest_run():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        strategy_id = body.get("strategy", "ma_cross").strip()
        params = body.get("params", {})
        capital = float(body.get("capital", 100000))
        days = int(body.get("days", 250))
        position_size = float(body.get("position_size", 1.0))
        commission_rate = float(body.get("commission_rate", 0.0003))
        slippage = float(body.get("slippage", 0.001))
        allow_short = body.get("allow_short", False)

        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400

        backtest_module = import_skill_module("backtest", "backtest_cli.py")
        data = backtest_module.backtest_with_strategy(
            symbol, strategy_id,
            initial_capital=capital, days=days,
            position_size=position_size,
            commission_rate=commission_rate,
            slippage=slippage,
            allow_short=allow_short,
            **params
        )
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/compare", methods=["POST"])
def api_backtest_compare():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        strategies = body.get("strategies", ["ma_cross", "macd", "rsi", "bollinger", "volume_breakout", "multi_factor"])
        capital = float(body.get("capital", 100000))
        days = int(body.get("days", 250))
        position_size = float(body.get("position_size", 1.0))
        commission_rate = float(body.get("commission_rate", 0.0003))
        slippage = float(body.get("slippage", 0.001))

        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400

        backtest_module = import_skill_module("backtest", "backtest_cli.py")
        results = []
        for sid in strategies:
            r = backtest_module.backtest_with_strategy(
                symbol, sid, initial_capital=capital, days=days,
                position_size=position_size,
                commission_rate=commission_rate,
                slippage=slippage
            )
            if 'error' not in r:
                results.append({
                    "策略ID": sid,
                    "策略名称": r["策略"]["name"],
                    "总收益率": r["绩效指标"].get("总收益率", 0),
                    "年化收益率": r["绩效指标"].get("年化收益率", 0),
                    "夏普比率": r["绩效指标"].get("夏普比率", 0),
                    "最大回撤": r["绩效指标"].get("最大回撤", 0),
                    "胜率": r["绩效指标"].get("胜率", 0),
                    "交易次数": r["绩效指标"].get("交易总次数", 0),
                    "超额收益": r["绩效指标"].get("超额收益", 0)
                })

        results.sort(key=lambda x: x["总收益率"], reverse=True)
        return jsonify({
            "股票代码": symbol,
            "回测天数": days,
            "策略对比": results,
            "最佳策略": results[0] if results else None
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/history")
def api_backtest_history():
    try:
        symbol = request.args.get("symbol", "").strip()
        strategy = request.args.get("strategy", "").strip()
        limit = int(request.args.get("limit", 50))
        from skill_loader import get_module
        get_backtest_records = getattr(get_module("data-storage"), "get_backtest_records", None)
        if get_backtest_records is None:
            return jsonify({"error": "data-storage 模块未加载"}), 500
        records = get_backtest_records(limit=limit, symbol=symbol or None, strategy=strategy or None)
        return jsonify({"记录数": len(records), "回测记录": records})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/trend")
def api_backtest_trend():
    try:
        symbol = request.args.get("symbol", "").strip()
        strategy = request.args.get("strategy", "").strip()
        limit = int(request.args.get("limit", 20))
        if not symbol or not strategy:
            return jsonify({"error": "请提供股票代码和策略名称"}), 400
        storage_module = import_skill_module("data-storage", "storage_cli.py")
        data = storage_module.get_backtest_trend(symbol, strategy, limit=limit)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/delete", methods=["POST"])
def api_backtest_delete():
    try:
        body = request.get_json()
        record_id = body.get("id")
        if not record_id:
            return jsonify({"error": "请提供记录ID"}), 400
        from skill_loader import get_module
        delete_backtest_record = getattr(get_module("data-storage"), "delete_backtest_record", None)
        if delete_backtest_record is None:
            return jsonify({"error": "data-storage 模块未加载"}), 500
        success = delete_backtest_record(int(record_id))
        return jsonify({"状态": "已删除" if success else "删除失败"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/custom", methods=["POST"])
def api_backtest_custom():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        buy_condition = body.get("buy_condition", "(ma5 > ma20) & (ma5.shift(1) <= ma20.shift(1))")
        sell_condition = body.get("sell_condition", "(ma5 < ma20) & (ma5.shift(1) >= ma20.shift(1))")
        capital = float(body.get("capital", 100000))
        days = int(body.get("days", 250))
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        backtest_module = import_skill_module("backtest", "backtest_cli.py")
        data = backtest_module.backtest_with_custom_signals(
            symbol, buy_condition, sell_condition,
            initial_capital=capital, days=days
        )
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/batch", methods=["POST"])
def api_backtest_batch():
    try:
        body = request.get_json()
        symbols = body.get("symbols", [])
        strategy_id = body.get("strategy", "ma_cross")
        days = int(body.get("days", 500))
        capital = float(body.get("capital", 100000))
        commission = float(body.get("commission", 0.0003))
        slippage = float(body.get("slippage", 0.001))
        position = float(body.get("position", 1.0))
        allow_short = body.get("allow_short", False)
        if not symbols:
            return jsonify({"error": "请提供股票代码列表"}), 400

        backtest_module = import_skill_module("backtest", "backtest_cli.py")
        from skill_loader import get_module
        save_backtest_record = getattr(get_module("data-storage"), "save_backtest_record", None)

        results = []
        for symbol in symbols:
            try:
                r = backtest_module.backtest_with_strategy(
                    symbol, strategy_id,
                    initial_capital=capital, days=days,
                    position_size=position,
                    commission_rate=commission,
                    slippage=slippage,
                    allow_short=allow_short
                )
                if 'error' not in r:
                    perf = r.get("绩效指标", {})
                    metrics = {
                        "累计收益率": perf.get("总收益率"),
                        "年化收益率": perf.get("年化收益率"),
                        "夏普比率": perf.get("夏普比率"),
                        "最大回撤": perf.get("最大回撤"),
                        "胜率": perf.get("胜率"),
                        "交易次数": perf.get("交易总次数"),
                        "Calmar比率": perf.get("Calmar比率"),
                        "年化波动率": perf.get("年化波动率")
                    }
                    if save_backtest_record:
                        save_backtest_record(symbol, strategy_id, metrics)
                    results.append({"股票": symbol, "策略": r["策略"]["name"], **metrics})
            except Exception:
                pass

        results.sort(key=lambda x: x.get("累计收益率") or 0, reverse=True)
        return jsonify({"策略": strategy_id, "回测天数": days, "股票数量": len(results), "results": results})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/records", methods=["GET"])
def api_backtest_records():
    try:
        symbol = request.args.get("symbol", "").strip() or None
        strategy = request.args.get("strategy", "").strip() or None
        limit = int(request.args.get("limit", 100))
        from skill_loader import get_module
        get_backtest_records = getattr(get_module("data-storage"), "get_backtest_records", None)
        if get_backtest_records is None:
            return jsonify({"error": "data-storage 模块未加载"}), 500
        records = get_backtest_records(limit=limit, symbol=symbol, strategy=strategy)
        return jsonify({"records": records, "count": len(records)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/records", methods=["DELETE"])
def api_backtest_records_clear():
    try:
        from skill_loader import get_module
        clear_backtest_records = getattr(get_module("data-storage"), "clear_backtest_records", None)
        if clear_backtest_records is None:
            return jsonify({"error": "data-storage 模块未加载"}), 500
        clear_backtest_records()
        return jsonify({"message": "所有回测记录已清空"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/records/<int:record_id>", methods=["DELETE"])
def api_backtest_record_delete(record_id):
    try:
        from skill_loader import get_module
        delete_backtest_record = getattr(get_module("data-storage"), "delete_backtest_record", None)
        if delete_backtest_record is None:
            return jsonify({"error": "data-storage 模块未加载"}), 500
        ok = delete_backtest_record(record_id)
        if ok:
            return jsonify({"message": "记录已删除"})
        else:
            return jsonify({"error": "记录不存在"}), 404
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/backtest/portfolio", methods=["POST"])
def api_backtest_portfolio():
    try:
        body = request.get_json()
        symbols = body.get("symbols", [])
        strategy_id = body.get("strategy", "ma_cross")
        params = body.get("params", {})
        capital = float(body.get("capital", 100000))
        days = int(body.get("days", 250))
        weights = body.get("weights", None)
        rebalance_freq = int(body.get("rebalance", 20))
        commission_rate = float(body.get("commission_rate", 0.0003))
        slippage = float(body.get("slippage", 0.001))
        if not symbols or len(symbols) < 2:
            return jsonify({"error": "至少需要2只股票"}), 400

        backtest_module = import_skill_module("backtest", "backtest_cli.py")
        result = backtest_module.backtest_portfolio(
            symbols, strategy_id,
            initial_capital=capital, days=days,
            weights=weights, rebalance_freq=rebalance_freq,
            commission_rate=commission_rate, slippage=slippage,
            **params
        )
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/optimizer/grid", methods=["POST"])
def api_optimizer_grid():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        strategy_id = body.get("strategy", "ma_cross")
        objective = body.get("objective", "sharpe")
        days = int(body.get("days", 250))
        top_n = int(body.get("top_n", 5))
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        recommend_strategy_params = getattr(get_module("strategy-framework"), "recommend_strategy_params", None)
        if recommend_strategy_params is None:
            return jsonify({"error": "strategy-framework 模块未加载"}), 500
        result = recommend_strategy_params(symbol, strategy_id, days=days, top_n=top_n, metric=objective)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/optimizer/ga", methods=["POST"])
def api_optimizer_ga():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        strategy_id = body.get("strategy", "ma_cross")
        objective = body.get("objective", "sharpe")
        days = int(body.get("days", 250))
        top_n = int(body.get("top_n", 10))
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        recommend_strategy_params = getattr(get_module("strategy-framework"), "recommend_strategy_params", None)
        if recommend_strategy_params is None:
            return jsonify({"error": "strategy-framework 模块未加载"}), 500
        result = recommend_strategy_params(symbol, strategy_id, days=days, top_n=top_n, metric=objective, max_combinations=500)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@backtest_bp.route("/api/optimizer/walkforward", methods=["POST"])
def api_optimizer_walkforward():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        strategy_id = body.get("strategy", "ma_cross")
        objective = body.get("objective", "sharpe")
        days = int(body.get("days", 500))
        top_n = int(body.get("top_n", 5))
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        recommend_strategy_params = getattr(get_module("strategy-framework"), "recommend_strategy_params", None)
        if recommend_strategy_params is None:
            return jsonify({"error": "strategy-framework 模块未加载"}), 500
        result = recommend_strategy_params(symbol, strategy_id, days=days, top_n=top_n, metric=objective)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500