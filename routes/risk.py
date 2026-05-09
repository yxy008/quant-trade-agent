#!/usr/bin/env python3
"""
风控系统/实时监控/蒙特卡洛模拟 路由
"""
import traceback
from flask import Blueprint, jsonify, request

from routes.utils import import_skill_module

risk_bp = Blueprint("risk", __name__)


@risk_bp.route("/api/risk/check", methods=["POST"])
def api_risk_check():
    try:
        body = request.get_json()
        positions = body.get("positions", [])
        market_data = body.get("market_data", None)
        mon_module = import_skill_module("risk-monitor", "monitor_cli.py")
        result = mon_module.realtime_risk_check(positions, market_data)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/risk/var", methods=["POST"])
def api_risk_var():
    try:
        body = request.get_json()
        returns = body.get("returns", [])
        confidence = float(body.get("confidence", 0.95))
        method = body.get("method", "historical")
        mon_module = import_skill_module("risk-monitor", "monitor_cli.py")
        result = mon_module.var_calculation(returns, confidence, method)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/risk/drawdown", methods=["POST"])
def api_risk_drawdown():
    try:
        body = request.get_json()
        equity = body.get("equity", [])
        mon_module = import_skill_module("risk-monitor", "monitor_cli.py")
        result = mon_module.drawdown_analysis(equity)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/risk/limits", methods=["POST"])
def api_risk_limits():
    try:
        body = request.get_json()
        positions = body.get("positions", [])
        limits = body.get("limits", {})
        mon_module = import_skill_module("risk-monitor", "monitor_cli.py")
        result = mon_module.risk_limits_check(positions, limits)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/risk/stress", methods=["POST"])
def api_risk_stress():
    try:
        body = request.get_json()
        positions = body.get("positions", [])
        scenarios = body.get("scenarios", [])
        mon_module = import_skill_module("risk-monitor", "monitor_cli.py")
        result = mon_module.stress_test(positions, scenarios)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/risk/pre-check", methods=["POST"])
def api_risk_pre_check():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        direction = body.get("direction", "buy")
        quantity = int(body.get("quantity", 0))
        price = float(body.get("price", 0))
        total_asset = float(body.get("total_asset", 100000))
        cash = float(body.get("cash", 100000))
        positions = body.get("positions", [])
        risk_config = body.get("risk_config", None)
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        pre_trade_check = getattr(get_module("risk-control"), "pre_trade_check", None)
        if pre_trade_check is None:
            return jsonify({"error": "risk-control 模块未加载"}), 500
        order_params = {"direction": direction, "quantity": quantity, "price": price}
        portfolio_state = {"total_asset": total_asset, "cash": cash, "positions": positions}
        result = pre_trade_check(symbol, order_params, portfolio_state, risk_config)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/risk/in-trade", methods=["POST"])
def api_risk_in_trade():
    try:
        body = request.get_json()
        positions = body.get("positions", [])
        market_data = body.get("market_data", {})
        risk_config = body.get("risk_config", None)
        if not positions:
            return jsonify({"error": "请提供持仓数据"}), 400
        from skill_loader import get_module
        in_trade_monitor = getattr(get_module("risk-control"), "in_trade_monitor", None)
        if in_trade_monitor is None:
            return jsonify({"error": "risk-control 模块未加载"}), 500
        result = in_trade_monitor(positions, market_data, risk_config)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/risk/post-trade", methods=["POST"])
def api_risk_post_trade():
    try:
        body = request.get_json()
        symbols = body.get("symbols", [])
        days = int(body.get("days", 250))
        risk_config = body.get("risk_config", None)
        if not symbols or len(symbols) < 1:
            return jsonify({"error": "请提供股票代码列表"}), 400
        from skill_loader import get_module
        post_trade_risk_analysis = getattr(get_module("risk-control"), "post_trade_risk_analysis", None)
        if post_trade_risk_analysis is None:
            return jsonify({"error": "risk-control 模块未加载"}), 500
        result = post_trade_risk_analysis(symbols, days=days, risk_config=risk_config)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/risk/stress-test", methods=["POST"])
def api_risk_stress_test():
    try:
        body = request.get_json()
        symbols = body.get("symbols", [])
        scenarios = body.get("scenarios", None)
        days = int(body.get("days", 250))
        if not symbols or len(symbols) < 1:
            return jsonify({"error": "请提供股票代码列表"}), 400
        from skill_loader import get_module
        stress_test_portfolio = getattr(get_module("risk-control"), "stress_test_portfolio", None)
        if stress_test_portfolio is None:
            return jsonify({"error": "risk-control 模块未加载"}), 500
        result = stress_test_portfolio(symbols, scenarios=scenarios, days=days)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/risk/var-breakdown", methods=["POST"])
def api_risk_var_breakdown():
    try:
        body = request.get_json()
        symbols = body.get("symbols", [])
        days = int(body.get("days", 250))
        if not symbols or len(symbols) < 2:
            return jsonify({"error": "至少需要2只股票"}), 400
        from skill_loader import get_module
        calculate_var_breakdown = getattr(get_module("risk-control"), "calculate_var_breakdown", None)
        if calculate_var_breakdown is None:
            return jsonify({"error": "risk-control 模块未加载"}), 500
        result = calculate_var_breakdown(symbols, days=days)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/risk/config/default", methods=["GET"])
def api_risk_default_config():
    try:
        from skill_loader import get_module
        get_default_risk_config = getattr(get_module("risk-control"), "get_default_risk_config", None)
        if get_default_risk_config is None:
            return jsonify({"error": "risk-control 模块未加载"}), 500
        config = get_default_risk_config()
        return jsonify(config)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/monitor/quote", methods=["POST"])
def api_monitor_quote():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from data_utils import get_realtime_quote
        data = get_realtime_quote(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/monitor/anomaly", methods=["POST"])
def api_monitor_anomaly():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        detect_anomalies = getattr(get_module("realtime-monitor"), "detect_anomalies", None)
        if detect_anomalies is None:
            return jsonify({"error": "realtime-monitor 模块未加载"}), 500
        data = detect_anomalies(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/monitor/pnl", methods=["POST"])
def api_monitor_pnl():
    try:
        body = request.get_json()
        positions = body.get("positions", [])
        from skill_loader import get_module
        calc_position_pnl = getattr(get_module("realtime-monitor"), "calc_position_pnl", None)
        if calc_position_pnl is None:
            return jsonify({"error": "realtime-monitor 模块未加载"}), 500
        data = calc_position_pnl(positions)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/monitor/portfolio", methods=["POST"])
def api_monitor_portfolio():
    try:
        body = request.get_json()
        positions = body.get("positions", [])
        from skill_loader import get_module
        monitor_portfolio = getattr(get_module("realtime-monitor"), "monitor_portfolio", None)
        if monitor_portfolio is None:
            return jsonify({"error": "realtime-monitor 模块未加载"}), 500
        data = monitor_portfolio(positions)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/monitor/market")
def api_monitor_market():
    try:
        from data_utils import get_market_overview
        data = get_market_overview()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/monte-carlo/simulate", methods=["POST"])
def api_monte_carlo():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        days = int(body.get("days", 500))
        simulations = int(body.get("simulations", 1000))
        horizon = int(body.get("horizon", 252))
        capital = float(body.get("capital", 100000))
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400

        from skill_loader import get_module
        mc_mod = get_module("monte-carlo")
        if mc_mod is None:
            return jsonify({"error": "monte-carlo 模块未加载"}), 500
        mc_get_kline = getattr(mc_mod, "get_stock_kline", None)
        monte_carlo_simulation = getattr(mc_mod, "monte_carlo_simulation", None)
        if mc_get_kline is None or monte_carlo_simulation is None:
            return jsonify({"error": "monte-carlo 函数未找到"}), 500

        df = mc_get_kline(symbol, days)
        if df is None or df.empty:
            return jsonify({"error": "无法获取K线数据"}), 500

        close = df['close'] if 'close' in df.columns else df['收盘']
        daily_returns = close.pct_change().dropna().tolist()

        result = monte_carlo_simulation(daily_returns, simulations, horizon, capital)
        result["股票代码"] = symbol
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@risk_bp.route("/api/monte-carlo/overfitting", methods=["POST"])
def api_overfitting_check():
    try:
        body = request.get_json()
        backtest_metrics = body.get("metrics", {})
        param_sensitivity = body.get("param_sensitivity", None)
        in_sample = body.get("in_sample_returns", None)
        out_sample = body.get("out_sample_returns", None)
        if not backtest_metrics:
            return jsonify({"error": "请提供回测绩效指标"}), 400
        from skill_loader import get_module
        detect_overfitting = getattr(get_module("monte-carlo"), "detect_overfitting", None)
        if detect_overfitting is None:
            return jsonify({"error": "monte-carlo 模块未加载"}), 500
        result = detect_overfitting(backtest_metrics, param_sensitivity, in_sample, out_sample)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500