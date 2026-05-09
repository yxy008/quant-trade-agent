#!/usr/bin/env python3
"""
定时任务调度/任务管理 路由
"""
import traceback
from flask import Blueprint, jsonify, request

scheduler_bp = Blueprint("scheduler", __name__)


@scheduler_bp.route("/api/scheduler/status")
def api_scheduler_status():
    try:
        from skill_loader import get_module
        get_scheduler_status = getattr(get_module("task-scheduler"), "get_scheduler_status", None)
        if get_scheduler_status is None:
            return jsonify({"error": "task-scheduler 模块未加载"}), 500
        data = get_scheduler_status()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@scheduler_bp.route("/api/scheduler/jobs")
def api_scheduler_jobs():
    try:
        from skill_loader import get_module
        list_jobs = getattr(get_module("task-scheduler"), "list_jobs", None)
        if list_jobs is None:
            return jsonify({"error": "task-scheduler 模块未加载"}), 500
        data = list_jobs()
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@scheduler_bp.route("/api/scheduler/job", methods=["POST"])
def api_scheduler_add_job():
    try:
        body = request.get_json()
        name = body.get("name", "").strip()
        func = body.get("func", "").strip()
        trigger = body.get("trigger", "interval")
        interval = int(body.get("interval", 3600))
        if not name or not func:
            return jsonify({"error": "请提供任务名称和函数"}), 400
        from skill_loader import get_module
        add_job = getattr(get_module("task-scheduler"), "add_job", None)
        if add_job is None:
            return jsonify({"error": "task-scheduler 模块未加载"}), 500
        result = add_job(name, func, trigger, interval)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@scheduler_bp.route("/api/scheduler/job/<job_id>", methods=["DELETE"])
def api_scheduler_remove_job(job_id):
    try:
        from skill_loader import get_module
        remove_job = getattr(get_module("task-scheduler"), "remove_job", None)
        if remove_job is None:
            return jsonify({"error": "task-scheduler 模块未加载"}), 500
        result = remove_job(job_id)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@scheduler_bp.route("/api/scheduler/job/<job_id>/pause", methods=["POST"])
def api_scheduler_pause_job(job_id):
    try:
        from skill_loader import get_module
        pause_job = getattr(get_module("task-scheduler"), "pause_job", None)
        if pause_job is None:
            return jsonify({"error": "task-scheduler 模块未加载"}), 500
        result = pause_job(job_id)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@scheduler_bp.route("/api/scheduler/job/<job_id>/resume", methods=["POST"])
def api_scheduler_resume_job(job_id):
    try:
        from skill_loader import get_module
        resume_job = getattr(get_module("task-scheduler"), "resume_job", None)
        if resume_job is None:
            return jsonify({"error": "task-scheduler 模块未加载"}), 500
        result = resume_job(job_id)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@scheduler_bp.route("/api/scheduler/start", methods=["POST"])
def api_scheduler_start():
    try:
        from skill_loader import get_module
        start_scheduler = getattr(get_module("task-scheduler"), "start_scheduler", None)
        if start_scheduler is None:
            return jsonify({"error": "task-scheduler 模块未加载"}), 500
        result = start_scheduler()
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@scheduler_bp.route("/api/scheduler/stop", methods=["POST"])
def api_scheduler_stop():
    try:
        from skill_loader import get_module
        stop_scheduler = getattr(get_module("task-scheduler"), "stop_scheduler", None)
        if stop_scheduler is None:
            return jsonify({"error": "task-scheduler 模块未加载"}), 500
        result = stop_scheduler()
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500