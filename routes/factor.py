#!/usr/bin/env python3
"""
因子分析/因子挖掘/因子回测 路由
"""
import traceback
from flask import Blueprint, jsonify, request

factor_bp = Blueprint("factor", __name__)


@factor_bp.route("/api/factor/list")
def api_factor_list():
    try:
        from skill_loader import get_module
        list_factors = getattr(get_module("factor-analysis"), "list_factors", None)
        if list_factors is None:
            return jsonify({"error": "factor-analysis 模块未加载"}), 500
        data = list_factors()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@factor_bp.route("/api/factor/calculate", methods=["POST"])
def api_factor_calculate():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        factor_name = body.get("factor", "").strip()
        if not symbol or not factor_name:
            return jsonify({"error": "请提供股票代码和因子名称"}), 400
        from skill_loader import get_module
        calculate_factor = getattr(get_module("factor-analysis"), "calculate_factor", None)
        if calculate_factor is None:
            return jsonify({"error": "factor-analysis 模块未加载"}), 500
        data = calculate_factor(symbol, factor_name)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@factor_bp.route("/api/factor/backtest", methods=["POST"])
def api_factor_backtest():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        factor_name = body.get("factor", "").strip()
        if not symbol or not factor_name:
            return jsonify({"error": "请提供股票代码和因子名称"}), 400
        from skill_loader import get_module
        factor_backtest = getattr(get_module("factor-analysis"), "factor_backtest", None)
        if factor_backtest is None:
            return jsonify({"error": "factor-analysis 模块未加载"}), 500
        data = factor_backtest(symbol, factor_name)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@factor_bp.route("/api/factor/ic", methods=["POST"])
def api_factor_ic():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        factor_name = body.get("factor", "").strip()
        if not symbol or not factor_name:
            return jsonify({"error": "请提供股票代码和因子名称"}), 400
        from skill_loader import get_module
        calculate_ic = getattr(get_module("factor-analysis"), "calculate_ic", None)
        if calculate_ic is None:
            return jsonify({"error": "factor-analysis 模块未加载"}), 500
        data = calculate_ic(symbol, factor_name)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@factor_bp.route("/api/factor/correlation", methods=["POST"])
def api_factor_correlation():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        factors = body.get("factors", [])
        if not symbol or not factors:
            return jsonify({"error": "请提供股票代码和因子列表"}), 400
        from skill_loader import get_module
        factor_correlation = getattr(get_module("factor-analysis"), "factor_correlation", None)
        if factor_correlation is None:
            return jsonify({"error": "factor-analysis 模块未加载"}), 500
        data = factor_correlation(symbol, factors)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@factor_bp.route("/api/factor/ranking", methods=["POST"])
def api_factor_ranking():
    try:
        body = request.get_json()
        factor_name = body.get("factor", "").strip()
        limit = int(body.get("limit", 20))
        if not factor_name:
            return jsonify({"error": "请提供因子名称"}), 400
        from skill_loader import get_module
        factor_ranking = getattr(get_module("factor-analysis"), "factor_ranking", None)
        if factor_ranking is None:
            return jsonify({"error": "factor-analysis 模块未加载"}), 500
        data = factor_ranking(factor_name, limit)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500