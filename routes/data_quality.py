#!/usr/bin/env python3
"""
数据质量检查/清洗/修复 路由
"""
import traceback
from flask import Blueprint, jsonify, request

data_quality_bp = Blueprint("data_quality", __name__)


@data_quality_bp.route("/api/data/quality/check", methods=["POST"])
def api_data_quality_check():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        check_data_quality = getattr(get_module("data-quality"), "check_data_quality", None)
        if check_data_quality is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = check_data_quality(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/clean", methods=["POST"])
def api_data_quality_clean():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        clean_data = getattr(get_module("data-quality"), "clean_data", None)
        if clean_data is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = clean_data(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/repair", methods=["POST"])
def api_data_quality_repair():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        repair_data = getattr(get_module("data-quality"), "repair_data", None)
        if repair_data is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = repair_data(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/report")
def api_data_quality_report():
    try:
        symbol = request.args.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        generate_quality_report = getattr(get_module("data-quality"), "generate_quality_report", None)
        if generate_quality_report is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = generate_quality_report(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/validate", methods=["POST"])
def api_data_quality_validate():
    try:
        body = request.get_json()
        data = body.get("data", [])
        rules = body.get("rules", {})
        if not data:
            return jsonify({"error": "请提供数据"}), 400
        from skill_loader import get_module
        validate_data = getattr(get_module("data-quality"), "validate_data", None)
        if validate_data is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        result = validate_data(data, rules)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/stats")
def api_data_quality_stats():
    try:
        symbol = request.args.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        get_data_stats = getattr(get_module("data-quality"), "get_data_stats", None)
        if get_data_stats is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = get_data_stats(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/missing")
def api_data_quality_missing():
    try:
        symbol = request.args.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        analyze_missing = getattr(get_module("data-quality"), "analyze_missing", None)
        if analyze_missing is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = analyze_missing(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/outliers")
def api_data_quality_outliers():
    try:
        symbol = request.args.get("symbol", "").strip()
        method = request.args.get("method", "iqr")
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        detect_outliers = getattr(get_module("data-quality"), "detect_outliers", None)
        if detect_outliers is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = detect_outliers(symbol, method)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/duplicates")
def api_data_quality_duplicates():
    try:
        symbol = request.args.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        check_duplicates = getattr(get_module("data-quality"), "check_duplicates", None)
        if check_duplicates is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = check_duplicates(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/consistency")
def api_data_quality_consistency():
    try:
        symbol = request.args.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        check_consistency = getattr(get_module("data-quality"), "check_consistency", None)
        if check_consistency is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = check_consistency(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/timeliness")
def api_data_quality_timeliness():
    try:
        symbol = request.args.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        check_timeliness = getattr(get_module("data-quality"), "check_timeliness", None)
        if check_timeliness is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = check_timeliness(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/completeness")
def api_data_quality_completeness():
    try:
        symbol = request.args.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        check_completeness = getattr(get_module("data-quality"), "check_completeness", None)
        if check_completeness is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = check_completeness(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/accuracy")
def api_data_quality_accuracy():
    try:
        symbol = request.args.get("symbol", "").strip()
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        check_accuracy = getattr(get_module("data-quality"), "check_accuracy", None)
        if check_accuracy is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = check_accuracy(symbol)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/batch", methods=["POST"])
def api_data_quality_batch():
    try:
        body = request.get_json()
        symbols = body.get("symbols", [])
        if not symbols:
            return jsonify({"error": "请提供股票代码列表"}), 400
        from skill_loader import get_module
        batch_quality_check = getattr(get_module("data-quality"), "batch_quality_check", None)
        if batch_quality_check is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = batch_quality_check(symbols)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/schedule", methods=["POST"])
def api_data_quality_schedule():
    try:
        body = request.get_json()
        symbols = body.get("symbols", [])
        cron = body.get("cron", "0 8 * * 1-5")
        if not symbols:
            return jsonify({"error": "请提供股票代码列表"}), 400
        from skill_loader import get_module
        schedule_quality_check = getattr(get_module("data-quality"), "schedule_quality_check", None)
        if schedule_quality_check is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = schedule_quality_check(symbols, cron)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/alerts")
def api_data_quality_alerts():
    try:
        limit = int(request.args.get("limit", 50))
        from skill_loader import get_module
        get_quality_alerts = getattr(get_module("data-quality"), "get_quality_alerts", None)
        if get_quality_alerts is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = get_quality_alerts(limit)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/alerts/<alert_id>", methods=["DELETE"])
def api_data_quality_alert_dismiss(alert_id):
    try:
        from skill_loader import get_module
        dismiss_alert = getattr(get_module("data-quality"), "dismiss_alert", None)
        if dismiss_alert is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = dismiss_alert(alert_id)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/config", methods=["GET"])
def api_data_quality_config():
    try:
        from skill_loader import get_module
        get_quality_config = getattr(get_module("data-quality"), "get_quality_config", None)
        if get_quality_config is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = get_quality_config()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@data_quality_bp.route("/api/data/quality/config", methods=["POST"])
def api_data_quality_config_update():
    try:
        body = request.get_json()
        from skill_loader import get_module
        update_quality_config = getattr(get_module("data-quality"), "update_quality_config", None)
        if update_quality_config is None:
            return jsonify({"error": "data-quality 模块未加载"}), 500
        data = update_quality_config(body)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500