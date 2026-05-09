#!/usr/bin/env python3
"""
统一 Skill 注册中心 - 自动发现、注册、调用所有 skill 模块
支持三种调用方式:
  1. Web API (Flask) - 现有方式
  2. CLI 命令行 - python skill_registry.py <skill_name> <action> [args]
  3. Python API - from skill_registry import call_skill
支持两种 skill 来源:
  1. 内置 skills - 项目 skills/ 目录下
  2. 外部 skills - 用户自定义目录，通过配置或 API 注册
"""
import os
import sys
import json
import importlib.util
import argparse
from datetime import datetime

AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILLS_DIR = os.path.join(AGENT_DIR, "skills")

# 外部 skill 目录配置文件
_EXTERNAL_SKILLS_CONFIG = os.path.join(AGENT_DIR, "external_skills.json")

# 确保 agent 目录在 path 中
if AGENT_DIR not in sys.path:
    sys.path.insert(0, AGENT_DIR)

# 全局 skill 注册表
SKILL_REGISTRY = {}

# 外部 skill 目录列表
_external_skill_dirs = []


def _load_external_skill_dirs():
    """从配置文件加载外部 skill 目录列表"""
    global _external_skill_dirs
    if _external_skill_dirs:
        return _external_skill_dirs

    if os.path.exists(_EXTERNAL_SKILLS_CONFIG):
        try:
            with open(_EXTERNAL_SKILLS_CONFIG, "r", encoding="utf-8") as f:
                config = json.load(f)
                _external_skill_dirs = config.get("external_dirs", [])
        except Exception:
            _external_skill_dirs = []
    return _external_skill_dirs


def _save_external_skill_dirs(dirs):
    """保存外部 skill 目录列表到配置文件"""
    global _external_skill_dirs
    _external_skill_dirs = list(dirs)
    with open(_EXTERNAL_SKILLS_CONFIG, "w", encoding="utf-8") as f:
        json.dump({"external_dirs": _external_skill_dirs}, f, ensure_ascii=False, indent=2)


def _scan_skill_dir(skill_dir, skill_name, source="内置"):
    """扫描单个 skill 目录，返回 skill 信息"""
    scripts_dir = os.path.join(skill_dir, "scripts")
    if not os.path.isdir(scripts_dir):
        return None

    cli_files = [f for f in os.listdir(scripts_dir) if f.endswith("_cli.py") and f != "__init__.py"]
    if not cli_files:
        return None

    main_file = cli_files[0]
    module_path = os.path.join(scripts_dir, main_file)
    module_name = main_file.replace(".py", "")

    description = ""
    skill_md = os.path.join(skill_dir, "SKILL.md")
    if os.path.exists(skill_md):
        try:
            with open(skill_md, "r", encoding="utf-8") as f:
                first_line = f.readline().strip()
                if first_line.startswith("#"):
                    description = first_line.lstrip("#").strip()
        except Exception:
            pass

    functions = _analyze_module_functions(module_path)

    return {
        "名称": skill_name,
        "描述": description,
        "路径": module_path,
        "模块名": module_name,
        "函数列表": functions,
        "脚本目录": scripts_dir,
        "来源": source,
    }


def discover_skills(force_reload=False):
    """
    自动扫描所有 skill 目录（内置 + 外部），发现所有可用的 skill 模块
    返回: {skill_name: {path, module, functions, description, source}}
    """
    global SKILL_REGISTRY

    if SKILL_REGISTRY and not force_reload:
        return SKILL_REGISTRY

    SKILL_REGISTRY = {}

    # 1. 扫描内置 skills
    if os.path.isdir(SKILLS_DIR):
        for skill_name in sorted(os.listdir(SKILLS_DIR)):
            skill_dir = os.path.join(SKILLS_DIR, skill_name)
            if not os.path.isdir(skill_dir):
                continue
            info = _scan_skill_dir(skill_dir, skill_name, source="内置")
            if info:
                SKILL_REGISTRY[skill_name] = info

    # 2. 扫描外部 skills
    for ext_dir in _load_external_skill_dirs():
        if not os.path.isdir(ext_dir):
            continue
        for skill_name in sorted(os.listdir(ext_dir)):
            skill_dir = os.path.join(ext_dir, skill_name)
            if not os.path.isdir(skill_dir):
                continue
            # 外部 skill 同名时内置优先
            if skill_name in SKILL_REGISTRY:
                continue
            info = _scan_skill_dir(skill_dir, skill_name, source="外部")
            if info:
                SKILL_REGISTRY[skill_name] = info

    return SKILL_REGISTRY


def add_external_skill_dir(dir_path):
    """添加外部 skill 目录"""
    dir_path = os.path.abspath(dir_path)
    if not os.path.isdir(dir_path):
        return {"error": f"目录不存在: {dir_path}"}

    dirs = _load_external_skill_dirs()
    if dir_path in dirs:
        return {"error": f"目录已存在: {dir_path}"}

    dirs.append(dir_path)
    _save_external_skill_dirs(dirs)
    discover_skills(force_reload=True)

    return {
        "success": True,
        "message": f"外部 skill 目录已添加: {dir_path}",
        "当前外部目录数": len(dirs),
    }


def remove_external_skill_dir(dir_path):
    """移除外部 skill 目录"""
    dir_path = os.path.abspath(dir_path)
    dirs = _load_external_skill_dirs()
    if dir_path not in dirs:
        return {"error": f"目录未注册: {dir_path}"}

    dirs.remove(dir_path)
    _save_external_skill_dirs(dirs)
    discover_skills(force_reload=True)

    return {
        "success": True,
        "message": f"外部 skill 目录已移除: {dir_path}",
        "当前外部目录数": len(dirs),
    }


def list_external_skill_dirs():
    """列出所有外部 skill 目录"""
    dirs = _load_external_skill_dirs()
    valid = []
    invalid = []
    for d in dirs:
        if os.path.isdir(d):
            valid.append(d)
        else:
            invalid.append(d)
    return {
        "有效目录": valid,
        "无效目录": invalid,
        "总数": len(dirs),
    }


def _analyze_module_functions(module_path):
    """分析模块中的公开函数"""
    functions = []
    try:
        with open(module_path, "r", encoding="utf-8") as f:
            content = f.read()

        import ast
        tree = ast.parse(content)
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.FunctionDef):
                if not node.name.startswith("_"):
                    # 获取函数签名
                    args = []
                    for arg in node.args.args:
                        args.append(arg.arg)
                    sig = f"{node.name}({', '.join(args)})"

                    # 获取 docstring
                    doc = ast.get_docstring(node)
                    if doc:
                        doc = doc.split("\n")[0].strip()

                    functions.append({
                        "名称": node.name,
                        "签名": sig,
                        "说明": doc or "",
                    })
    except Exception:
        pass

    return functions


def load_skill_module(skill_name):
    """动态加载指定 skill 模块"""
    registry = discover_skills()

    if skill_name not in registry:
        available = list(registry.keys())
        return None, f"未找到 skill: {skill_name}，可用: {', '.join(available)}"

    info = registry[skill_name]
    module_path = info["路径"]
    module_name = info["模块名"]

    try:
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module, None
    except Exception as e:
        return None, f"加载 skill {skill_name} 失败: {str(e)}"


def call_skill(skill_name, function_name, *args, **kwargs):
    """
    统一调用接口 - 通过 Python API 调用任意 skill 的任意函数

    示例:
        result = call_skill("financial-data", "get_financial_metrics", "600036")
        result = call_skill("stock-scoring", "score_stock", symbol="600519")
    """
    module, error = load_skill_module(skill_name)
    if error:
        return {"error": error}

    if not hasattr(module, function_name):
        funcs = [f["名称"] for f in SKILL_REGISTRY.get(skill_name, {}).get("函数列表", [])]
        return {"error": f"函数 {function_name} 不存在，可用: {', '.join(funcs)}"}

    try:
        func = getattr(module, function_name)
        result = func(*args, **kwargs)
        return result
    except Exception as e:
        return {"error": f"调用 {skill_name}.{function_name} 失败: {str(e)}"}


def list_skills():
    """列出所有可用的 skill"""
    registry = discover_skills()
    skills_list = []
    for name, info in registry.items():
        skills_list.append({
            "名称": name,
            "描述": info["描述"],
            "函数数": len(info["函数列表"]),
            "函数": [f["名称"] for f in info["函数列表"]],
        })
    return {
        "总数": len(skills_list),
        "Skills": skills_list,
        "查询时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def get_skill_info(skill_name):
    """获取指定 skill 的详细信息"""
    registry = discover_skills()
    if skill_name not in registry:
        return {"error": f"未找到 skill: {skill_name}"}
    return registry[skill_name]


# ==================== CLI 入口 ====================

def main():
    parser = argparse.ArgumentParser(
        description="量化交易系统 Skill 注册中心 - 统一调用入口",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python skill_registry.py list                                    # 列出所有 skill
  python skill_registry.py info financial-data                     # 查看 skill 详情
  python skill_registry.py call financial-data get_financial_metrics 600036  # 调用函数
  python skill_registry.py call stock-scoring score_stock 600519   # 评分股票
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="命令")

    # list 命令
    subparsers.add_parser("list", help="列出所有可用的 skill")

    # info 命令
    info_parser = subparsers.add_parser("info", help="查看 skill 详细信息")
    info_parser.add_argument("skill_name", help="skill 名称")

    # call 命令
    call_parser = subparsers.add_parser("call", help="调用 skill 函数")
    call_parser.add_argument("skill_name", help="skill 名称")
    call_parser.add_argument("function", help="函数名")
    call_parser.add_argument("args", nargs="*", help="位置参数")
    call_parser.add_argument("--kwargs", nargs="*", help="关键字参数 (key=value 格式)")

    args = parser.parse_args()

    if args.command == "list":
        result = list_skills()
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif args.command == "info":
        result = get_skill_info(args.skill_name)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif args.command == "call":
        # 解析 kwargs
        kwargs = {}
        if args.kwargs:
            for kv in args.kwargs:
                if "=" in kv:
                    key, value = kv.split("=", 1)
                    # 尝试转换数值类型
                    try:
                        value = int(value)
                    except ValueError:
                        try:
                            value = float(value)
                        except ValueError:
                            pass
                    kwargs[key] = value

        result = call_skill(args.skill_name, args.function, *args.args, **kwargs)
        if isinstance(result, dict):
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print(result)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
