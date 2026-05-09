#!/usr/bin/env python3
"""
Skills 管理/注册/发现/调用 路由
"""
import os
import traceback
from flask import Blueprint, jsonify, request

from routes.utils import import_skill_module

skills_bp = Blueprint("skills", __name__)
SKILLS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills")


@skills_bp.route("/api/skills/list")
def api_skills_list():
    try:
        from skill_registry import get_all_skills
        skills = get_all_skills()
        return jsonify({"skills": skills})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>")
def api_skill_detail(skill_name):
    try:
        from skill_registry import get_skill_info
        info = get_skill_info(skill_name)
        if info is None:
            return jsonify({"error": f"Skill '{skill_name}' 不存在"}), 404
        return jsonify(info)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/call", methods=["POST"])
def api_skill_call(skill_name):
    try:
        body = request.get_json() or {}
        from skill_loader import call_skill
        result = call_skill(skill_name, **body)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/reload", methods=["POST"])
def api_skills_reload():
    try:
        from skill_loader import reload_skills
        reload_skills()
        return jsonify({"status": "ok", "message": "Skills 已重新加载"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/refresh", methods=["POST"])
def api_skills_refresh():
    try:
        from skill_registry import refresh_registry
        refresh_registry()
        return jsonify({"status": "ok", "message": "Skills 注册表已刷新"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/status")
def api_skills_status():
    try:
        from skill_loader import get_skills_status
        status = get_skills_status()
        return jsonify(status)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/register", methods=["POST"])
def api_skills_register():
    try:
        body = request.get_json()
        name = body.get("name", "").strip()
        path = body.get("path", "").strip()
        if not name or not path:
            return jsonify({"error": "请提供 skill 名称和路径"}), 400
        from skill_registry import register_skill
        result = register_skill(name, path)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>", methods=["DELETE"])
def api_skills_unregister(skill_name):
    try:
        from skill_registry import unregister_skill
        result = unregister_skill(skill_name)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/enable", methods=["POST"])
def api_skills_enable(skill_name):
    try:
        from skill_registry import enable_skill
        result = enable_skill(skill_name)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/disable", methods=["POST"])
def api_skills_disable(skill_name):
    try:
        from skill_registry import disable_skill
        result = disable_skill(skill_name)
        return result
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/config", methods=["GET"])
def api_skills_get_config(skill_name):
    try:
        from skill_registry import get_skill_config
        config = get_skill_config(skill_name)
        return jsonify(config)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/config", methods=["POST"])
def api_skills_update_config(skill_name):
    try:
        body = request.get_json()
        from skill_registry import update_skill_config
        result = update_skill_config(skill_name, body)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/deps")
def api_skills_deps(skill_name):
    try:
        from skill_registry import get_skill_dependencies
        deps = get_skill_dependencies(skill_name)
        return jsonify({"skill": skill_name, "dependencies": deps})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/version")
def api_skills_version(skill_name):
    try:
        from skill_registry import get_skill_version
        version = get_skill_version(skill_name)
        return jsonify({"skill": skill_name, "version": version})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/docs")
def api_skills_docs(skill_name):
    try:
        from skill_registry import get_skill_docs
        docs = get_skill_docs(skill_name)
        return jsonify({"skill": skill_name, "docs": docs})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/test", methods=["POST"])
def api_skills_test(skill_name):
    try:
        body = request.get_json() or {}
        from skill_registry import test_skill
        result = test_skill(skill_name, body)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/logs")
def api_skills_logs(skill_name):
    try:
        limit = int(request.args.get("limit", 50))
        from skill_registry import get_skill_logs
        logs = get_skill_logs(skill_name, limit)
        return jsonify({"skill": skill_name, "logs": logs})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/metrics")
def api_skills_metrics(skill_name):
    try:
        from skill_registry import get_skill_metrics
        metrics = get_skill_metrics(skill_name)
        return jsonify({"skill": skill_name, "metrics": metrics})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/health")
def api_skills_health(skill_name):
    try:
        from skill_registry import check_skill_health
        health = check_skill_health(skill_name)
        return jsonify({"skill": skill_name, "health": health})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/export")
def api_skills_export(skill_name):
    try:
        from skill_registry import export_skill
        result = export_skill(skill_name)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/import", methods=["POST"])
def api_skills_import():
    try:
        body = request.get_json()
        from skill_registry import import_skill
        result = import_skill(body)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/search")
def api_skills_search():
    try:
        keyword = request.args.get("q", "").strip()
        if not keyword:
            return jsonify({"error": "请提供搜索关键词"}), 400
        from skill_registry import search_skills
        results = search_skills(keyword)
        return jsonify({"keyword": keyword, "results": results})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/categories")
def api_skills_categories():
    try:
        from skill_registry import get_skill_categories
        categories = get_skill_categories()
        return jsonify({"categories": categories})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/stats")
def api_skills_stats():
    try:
        from skill_registry import get_skills_stats
        stats = get_skills_stats()
        return jsonify(stats)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/graph")
def api_skills_graph():
    try:
        from skill_registry import get_skills_dependency_graph
        graph = get_skills_dependency_graph()
        return jsonify(graph)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/hotfix", methods=["POST"])
def api_skills_hotfix(skill_name):
    try:
        body = request.get_json()
        from skill_registry import hotfix_skill
        result = hotfix_skill(skill_name, body)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/rollback", methods=["POST"])
def api_skills_rollback(skill_name):
    try:
        from skill_registry import rollback_skill
        result = rollback_skill(skill_name)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/audit")
def api_skills_audit(skill_name):
    try:
        from skill_registry import audit_skill
        result = audit_skill(skill_name)
        return jsonify({"skill": skill_name, "audit": result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/permissions")
def api_skills_permissions(skill_name):
    try:
        from skill_registry import get_skill_permissions
        perms = get_skill_permissions(skill_name)
        return jsonify({"skill": skill_name, "permissions": perms})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/permissions", methods=["POST"])
def api_skills_update_permissions(skill_name):
    try:
        body = request.get_json()
        from skill_registry import update_skill_permissions
        result = update_skill_permissions(skill_name, body)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/rate-limit")
def api_skills_rate_limit(skill_name):
    try:
        from skill_registry import get_skill_rate_limit
        limit = get_skill_rate_limit(skill_name)
        return jsonify({"skill": skill_name, "rate_limit": limit})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/rate-limit", methods=["POST"])
def api_skills_update_rate_limit(skill_name):
    try:
        body = request.get_json()
        from skill_registry import update_skill_rate_limit
        result = update_skill_rate_limit(skill_name, body)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/schedule", methods=["POST"])
def api_skills_schedule(skill_name):
    try:
        body = request.get_json()
        cron = body.get("cron", "").strip()
        if not cron:
            return jsonify({"error": "请提供 cron 表达式"}), 400
        from skill_registry import schedule_skill
        result = schedule_skill(skill_name, cron)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/schedule", methods=["DELETE"])
def api_skills_unschedule(skill_name):
    try:
        from skill_registry import unschedule_skill
        result = unschedule_skill(skill_name)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/backup", methods=["POST"])
def api_skills_backup(skill_name):
    try:
        from skill_registry import backup_skill
        result = backup_skill(skill_name)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/restore", methods=["POST"])
def api_skills_restore(skill_name):
    try:
        body = request.get_json()
        backup_id = body.get("backup_id", "").strip()
        if not backup_id:
            return jsonify({"error": "请提供备份ID"}), 400
        from skill_registry import restore_skill
        result = restore_skill(skill_name, backup_id)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/backups")
def api_skills_backups(skill_name):
    try:
        from skill_registry import list_skill_backups
        backups = list_skill_backups(skill_name)
        return jsonify({"skill": skill_name, "backups": backups})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/events")
def api_skills_events(skill_name):
    try:
        limit = int(request.args.get("limit", 50))
        from skill_registry import get_skill_events
        events = get_skill_events(skill_name, limit)
        return jsonify({"skill": skill_name, "events": events})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/subscribe", methods=["POST"])
def api_skills_subscribe(skill_name):
    try:
        body = request.get_json()
        event = body.get("event", "").strip()
        callback = body.get("callback", "").strip()
        if not event or not callback:
            return jsonify({"error": "请提供事件和回调"}), 400
        from skill_registry import subscribe_skill_event
        result = subscribe_skill_event(skill_name, event, callback)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@skills_bp.route("/api/skills/<skill_name>/unsubscribe", methods=["POST"])
def api_skills_unsubscribe(skill_name):
    try:
        body = request.get_json()
        event = body.get("event", "").strip()
        if not event:
            return jsonify({"error": "请提供事件名称"}), 400
        from skill_registry import unsubscribe_skill_event
        result = unsubscribe_skill_event(skill_name, event)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500