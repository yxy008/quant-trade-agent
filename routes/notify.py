#!/usr/bin/env python3
"""
消息推送/通知管理 路由
"""
import traceback
from flask import Blueprint, jsonify, request

notify_bp = Blueprint("notify", __name__)


@notify_bp.route("/api/notify/send", methods=["POST"])
def api_notify_send():
    try:
        body = request.get_json()
        channel = body.get("channel", "email")
        title = body.get("title", "").strip()
        content = body.get("content", "").strip()
        recipients = body.get("recipients", [])
        if not title or not content:
            return jsonify({"error": "请提供标题和内容"}), 400
        from skill_loader import get_module
        send_notification = getattr(get_module("notification"), "send_notification", None)
        if send_notification is None:
            return jsonify({"error": "notification 模块未加载"}), 500
        data = send_notification(channel, title, content, recipients)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@notify_bp.route("/api/notify/channels")
def api_notify_channels():
    try:
        from skill_loader import get_module
        get_channels = getattr(get_module("notification"), "get_channels", None)
        if get_channels is None:
            return jsonify({"error": "notification 模块未加载"}), 500
        data = get_channels()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@notify_bp.route("/api/notify/config", methods=["GET"])
def api_notify_config():
    try:
        from skill_loader import get_module
        get_notify_config = getattr(get_module("notification"), "get_notify_config", None)
        if get_notify_config is None:
            return jsonify({"error": "notification 模块未加载"}), 500
        data = get_notify_config()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@notify_bp.route("/api/notify/config", methods=["POST"])
def api_notify_config_update():
    try:
        body = request.get_json()
        from skill_loader import get_module
        update_notify_config = getattr(get_module("notification"), "update_notify_config", None)
        if update_notify_config is None:
            return jsonify({"error": "notification 模块未加载"}), 500
        data = update_notify_config(body)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@notify_bp.route("/api/notify/history")
def api_notify_history():
    try:
        limit = int(request.args.get("limit", 50))
        from skill_loader import get_module
        get_notify_history = getattr(get_module("notification"), "get_notify_history", None)
        if get_notify_history is None:
            return jsonify({"error": "notification 模块未加载"}), 500
        data = get_notify_history(limit)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@notify_bp.route("/api/notify/template", methods=["POST"])
def api_notify_template():
    try:
        body = request.get_json()
        name = body.get("name", "").strip()
        template = body.get("template", "").strip()
        if not name or not template:
            return jsonify({"error": "请提供模板名称和内容"}), 400
        from skill_loader import get_module
        save_template = getattr(get_module("notification"), "save_template", None)
        if save_template is None:
            return jsonify({"error": "notification 模块未加载"}), 500
        data = save_template(name, template)
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@notify_bp.route("/api/notify/templates")
def api_notify_templates():
    try:
        from skill_loader import get_module
        get_templates = getattr(get_module("notification"), "get_templates", None)
        if get_templates is None:
            return jsonify({"error": "notification 模块未加载"}), 500
        data = get_templates()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500