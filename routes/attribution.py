#!/usr/bin/env python3
"""
归因分析/绩效归因 路由
"""
import traceback
from flask import Blueprint, jsonify, request

attribution_bp = Blueprint("attribution", __name__)


@attribution_bp.route("/api/attribution/brinson", methods=["POST"])
def api_attribution_brinson():
    try:
        body = request.get_json()
        portfolio_returns = body.get("portfolio_returns", [])
        benchmark_returns = body.get("benchmark_returns", [])
        weights = body.get("weights", [])
        benchmark_weights = body.get("benchmark_weights", [])
        if not portfolio_returns or not benchmark_returns:
            return jsonify({"error": "请提供组合和基准收益数据"}), 400
        from skill_loader import get_module
        brinson_attribution = getattr(get_module("attribution"), "brinson_attribution", None)
        if brinson_attribution is None:
            return jsonify({"error": "attribution 模块未加载"}), 500
        data = brinson_attribution(portfolio_returns, benchmark_returns, weights, benchmark_weights)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@attribution_bp.route("/api/attribution/factor", methods=["POST"])
def api_attribution_factor():
    try:
        body = request.get_json()
        returns = body.get("returns", [])
        factors = body.get("factors", {})
        if not returns or not factors:
            return jsonify({"error": "请提供收益和因子数据"}), 400
        from skill_loader import get_module
        factor_attribution = getattr(get_module("attribution"), "factor_attribution", None)
        if factor_attribution is None:
            return jsonify({"error": "attribution 模块未加载"}), 500
        data = factor_attribution(returns, factors)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@attribution_bp.route("/api/attribution/sector", methods=["POST"])
def api_attribution_sector():
    try:
        body = request.get_json()
        returns = body.get("returns", [])
        sectors = body.get("sectors", [])
        if not returns or not sectors:
            return jsonify({"error": "请提供收益和行业数据"}), 400
        from skill_loader import get_module
        sector_attribution = getattr(get_module("attribution"), "sector_attribution", None)
        if sector_attribution is None:
            return jsonify({"error": "attribution 模块未加载"}), 500
        data = sector_attribution(returns, sectors)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@attribution_bp.route("/api/attribution/report", methods=["POST"])
def api_attribution_report():
    try:
        body = request.get_json()
        portfolio_data = body.get("portfolio", {})
        benchmark_data = body.get("benchmark", {})
        if not portfolio_data or not benchmark_data:
            return jsonify({"error": "请提供组合和基准数据"}), 400
        from skill_loader import get_module
        generate_attribution_report = getattr(get_module("attribution"), "generate_attribution_report", None)
        if generate_attribution_report is None:
            return jsonify({"error": "attribution 模块未加载"}), 500
        data = generate_attribution_report(portfolio_data, benchmark_data)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500