#!/usr/bin/env python3
"""
AI Agent 对话/分析/策略生成 路由
"""
import traceback
from flask import Blueprint, jsonify, request

from routes.utils import cache_get, cache_set, CACHE_TTL

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/api/ai/chat", methods=["POST"])
def api_ai_chat():
    try:
        body = request.get_json()
        message = body.get("message", "").strip()
        context = body.get("context", None)
        if not message:
            return jsonify({"error": "请输入消息"}), 400
        from skill_loader import get_module
        ai_chat = getattr(get_module("ai-agent"), "ai_chat", None)
        if ai_chat is None:
            return jsonify({"error": "ai-agent 模块未加载"}), 500
        data = ai_chat(message, context=context)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/api/ai/analyze", methods=["POST"])
def api_ai_analyze():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        analysis_type = body.get("type", "comprehensive")
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        ai_analyze_stock = getattr(get_module("ai-agent"), "ai_analyze_stock", None)
        if ai_analyze_stock is None:
            return jsonify({"error": "ai-agent 模块未加载"}), 500
        data = ai_analyze_stock(symbol, analysis_type)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/api/ai/strategy", methods=["POST"])
def api_ai_strategy():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        style = body.get("style", "balanced")
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        from skill_loader import get_module
        ai_generate_strategy = getattr(get_module("ai-agent"), "ai_generate_strategy", None)
        if ai_generate_strategy is None:
            return jsonify({"error": "ai-agent 模块未加载"}), 500
        data = ai_generate_strategy(symbol, style)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/api/ai/market", methods=["POST"])
def api_ai_market():
    try:
        body = request.get_json()
        query = body.get("query", "").strip()
        if not query:
            return jsonify({"error": "请输入查询内容"}), 400
        from skill_loader import get_module
        ai_market_analysis = getattr(get_module("ai-agent"), "ai_market_analysis", None)
        if ai_market_analysis is None:
            return jsonify({"error": "ai-agent 模块未加载"}), 500
        data = ai_market_analysis(query)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/api/ai/config", methods=["GET"])
def api_ai_config():
    try:
        from skill_loader import get_module
        get_ai_config = getattr(get_module("ai-agent"), "get_ai_config", None)
        if get_ai_config is None:
            return jsonify({"error": "ai-agent 模块未加载"}), 500
        config = get_ai_config()
        return jsonify(config)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/api/ai/config", methods=["POST"])
def api_ai_config_update():
    try:
        body = request.get_json()
        from skill_loader import get_module
        update_ai_config = getattr(get_module("ai-agent"), "update_ai_config", None)
        if update_ai_config is None:
            return jsonify({"error": "ai-agent 模块未加载"}), 500
        result = update_ai_config(body)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/api/ai/models", methods=["GET"])
def api_ai_models():
    try:
        from skill_loader import get_module
        get_available_models = getattr(get_module("ai-agent"), "get_available_models", None)
        if get_available_models is None:
            return jsonify({"error": "ai-agent 模块未加载"}), 500
        models = get_available_models()
        return jsonify(models)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/api/ai/history", methods=["GET"])
def api_ai_history():
    try:
        limit = int(request.args.get("limit", 50))
        from skill_loader import get_module
        get_chat_history = getattr(get_module("ai-agent"), "get_chat_history", None)
        if get_chat_history is None:
            return jsonify({"error": "ai-agent 模块未加载"}), 500
        history = get_chat_history(limit)
        return jsonify(history)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/api/ai/history", methods=["DELETE"])
def api_ai_history_clear():
    try:
        from skill_loader import get_module
        clear_chat_history = getattr(get_module("ai-agent"), "clear_chat_history", None)
        if clear_chat_history is None:
            return jsonify({"error": "ai-agent 模块未加载"}), 500
        clear_chat_history()
        return jsonify({"message": "对话历史已清空"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500