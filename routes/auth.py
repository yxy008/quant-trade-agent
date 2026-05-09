#!/usr/bin/env python3
"""
用户认证/注册/登录/密码修改 路由
"""
import traceback
from flask import Blueprint, jsonify, request

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth/register", methods=["POST"])
def api_auth_register():
    try:
        body = request.get_json()
        username = body.get("username", "").strip()
        password = body.get("password", "").strip()
        if not username or not password:
            return jsonify({"error": "用户名和密码不能为空"}), 400
        from auth_cli import register_user
        result = register_user(username, password)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/auth/login", methods=["POST"])
def api_auth_login():
    try:
        body = request.get_json()
        username = body.get("username", "").strip()
        password = body.get("password", "").strip()
        if not username or not password:
            return jsonify({"error": "用户名和密码不能为空"}), 400
        from auth_cli import login_user
        result = login_user(username, password)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/auth/change-password", methods=["POST"])
def api_auth_change_password():
    try:
        body = request.get_json()
        username = body.get("username", "").strip()
        old_password = body.get("old_password", "").strip()
        new_password = body.get("new_password", "").strip()
        if not username or not old_password or not new_password:
            return jsonify({"error": "请填写完整信息"}), 400
        from auth_cli import change_password
        result = change_password(username, old_password, new_password)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/auth/reset-password", methods=["POST"])
def api_auth_reset_password():
    try:
        body = request.get_json()
        username = body.get("username", "").strip()
        new_password = body.get("new_password", "").strip()
        if not username or not new_password:
            return jsonify({"error": "请填写完整信息"}), 400
        from auth_cli import reset_password
        result = reset_password(username, new_password)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/auth/users", methods=["GET"])
def api_auth_users():
    try:
        from auth_cli import list_users
        users = list_users()
        return jsonify({"users": users})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500