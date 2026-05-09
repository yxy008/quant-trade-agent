#!/usr/bin/env python3
"""
模拟交易/订单管理(OMS) 路由
"""
import traceback
from flask import Blueprint, jsonify, request

from routes.utils import import_skill_module

trading_bp = Blueprint("trading", __name__)


@trading_bp.route("/api/paper/init", methods=["POST"])
def api_paper_init():
    try:
        pt_module = import_skill_module("paper-trading", "paper_trading_cli.py")
        success = pt_module.init_paper_trading_tables()
        return jsonify({"success": success})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/paper/account", methods=["POST"])
def api_paper_create_account():
    try:
        body = request.get_json()
        capital = float(body.get("capital", 100000))
        name = body.get("name", "默认账户")
        pt_module = import_skill_module("paper-trading", "paper_trading_cli.py")
        account = pt_module.get_or_create_account(initial_capital=capital, account_name=name)
        return jsonify(account.get_summary())
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/paper/account", methods=["GET"])
def api_paper_get_account():
    try:
        account_id = request.args.get("account_id", "").strip() or None
        pt_module = import_skill_module("paper-trading", "paper_trading_cli.py")
        account = pt_module.get_or_create_account(account_id=account_id)
        return jsonify(account.get_summary())
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/paper/order", methods=["POST"])
def api_paper_place_order():
    try:
        body = request.get_json()
        account_id = body.get("account_id", "").strip() or None
        symbol = body.get("symbol", "").strip()
        direction = body.get("direction", "buy")
        quantity = int(body.get("quantity", 100))
        order_type = body.get("order_type", "market")
        price = body.get("price")
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        pt_module = import_skill_module("paper-trading", "paper_trading_cli.py")
        account = pt_module.get_or_create_account(account_id=account_id)
        result = account.place_order(symbol, direction, quantity, order_type, price)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/paper/positions", methods=["GET"])
def api_paper_positions():
    try:
        account_id = request.args.get("account_id", "").strip() or None
        pt_module = import_skill_module("paper-trading", "paper_trading_cli.py")
        account = pt_module.get_or_create_account(account_id=account_id)
        return jsonify({"positions": account.get_positions()})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/paper/orders", methods=["GET"])
def api_paper_orders():
    try:
        account_id = request.args.get("account_id", "").strip() or None
        limit = int(request.args.get("limit", 50))
        pt_module = import_skill_module("paper-trading", "paper_trading_cli.py")
        account = pt_module.get_or_create_account(account_id=account_id)
        return jsonify({"orders": account.get_orders(limit)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/paper/trades", methods=["GET"])
def api_paper_trades():
    try:
        account_id = request.args.get("account_id", "").strip() or None
        limit = int(request.args.get("limit", 50))
        pt_module = import_skill_module("paper-trading", "paper_trading_cli.py")
        account = pt_module.get_or_create_account(account_id=account_id)
        return jsonify({"trades": account.get_trades(limit)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/paper/order/cancel", methods=["POST"])
def api_paper_cancel_order():
    try:
        body = request.get_json()
        account_id = body.get("account_id", "").strip() or None
        order_id = body.get("order_id", "").strip()
        if not order_id:
            return jsonify({"error": "请提供订单ID"}), 400
        pt_module = import_skill_module("paper-trading", "paper_trading_cli.py")
        account = pt_module.get_or_create_account(account_id=account_id)
        result = account.cancel_order(order_id)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/oms/twap", methods=["POST"])
def api_oms_twap():
    try:
        body = request.get_json()
        qty = int(body.get("qty", 0))
        slots = int(body.get("slots", 0))
        price = body.get("price")
        price_range = body.get("range")
        oms_module = import_skill_module("oms", "oms_cli.py")
        result = oms_module.twap_split(qty, slots, price, price_range)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/oms/vwap", methods=["POST"])
def api_oms_vwap():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        qty = int(body.get("qty", 0))
        slots = int(body.get("slots", 0))
        days = int(body.get("days", 5))
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        oms_module = import_skill_module("oms", "oms_cli.py")
        result = oms_module.vwap_split(symbol, qty, slots, days)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/oms/iceberg", methods=["POST"])
def api_oms_iceberg():
    try:
        body = request.get_json()
        qty = int(body.get("qty", 0))
        visible = int(body.get("visible", 0))
        price = body.get("price")
        oms_module = import_skill_module("oms", "oms_cli.py")
        result = oms_module.iceberg_order(qty, visible, price)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/oms/smart", methods=["POST"])
def api_oms_smart():
    try:
        body = request.get_json()
        symbol = body.get("symbol", "").strip()
        side = body.get("side", "buy")
        qty = int(body.get("qty", 0))
        urgency = body.get("urgency", "normal")
        if not symbol:
            return jsonify({"error": "请提供股票代码"}), 400
        oms_module = import_skill_module("oms", "oms_cli.py")
        result = oms_module.smart_order(symbol, side, qty, urgency)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@trading_bp.route("/api/oms/modify", methods=["POST"])
def api_oms_modify():
    try:
        body = request.get_json()
        order_id = body.get("order_id", "").strip()
        new_price = body.get("price")
        new_qty = body.get("qty")
        if not order_id:
            return jsonify({"error": "请提供订单ID"}), 400
        oms_module = import_skill_module("oms", "oms_cli.py")
        result = oms_module.modify_order(order_id, new_price, new_qty)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500