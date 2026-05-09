#!/usr/bin/env python3
"""
Skill 注册与发现机制
自动扫描 skills 目录，动态加载所有 skill 模块，降低主项目与 skill 的耦合
同时支持自动生成 OpenAI function call 格式的 tool 定义
"""
import sys
import os
import json
import importlib.util
import traceback
from typing import Dict, List, Any, Optional, Callable

SKILLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skills")

_skill_registry: Dict[str, Dict[str, Any]] = {}
_module_cache: Dict[str, Any] = {}
_loaded = False


def _read_meta(skill_dir: str) -> Optional[Dict[str, Any]]:
    """读取 skill 的 _meta.json"""
    meta_path = os.path.join(skill_dir, "_meta.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return None


def _read_skill_md(skill_dir: str) -> Optional[Dict[str, str]]:
    """读取 SKILL.md 的 frontmatter 和描述"""
    md_path = os.path.join(skill_dir, "SKILL.md")
    if not os.path.exists(md_path):
        return None
    try:
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        return None

    result = {"name": "", "description": "", "full_content": content}
    lines = content.split("\n")
    in_frontmatter = False
    frontmatter_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped == "---":
            if not in_frontmatter:
                in_frontmatter = True
                continue
            else:
                break
        if in_frontmatter:
            frontmatter_lines.append(stripped)

    for fl in frontmatter_lines:
        if ":" in fl:
            key, _, value = fl.partition(":")
            key = key.strip()
            value = value.strip()
            if key in result:
                result[key] = value

    if not result["description"]:
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and not stripped.startswith("---"):
                result["description"] = stripped[:200]
                break

    return result


def _discover_skills() -> Dict[str, Dict[str, Any]]:
    """扫描 skills 目录，发现所有 skill"""
    registry = {}
    if not os.path.isdir(SKILLS_DIR):
        return registry

    for entry in sorted(os.listdir(SKILLS_DIR)):
        skill_dir = os.path.join(SKILLS_DIR, entry)
        if not os.path.isdir(skill_dir):
            continue
        scripts_dir = os.path.join(skill_dir, "scripts")
        if not os.path.isdir(scripts_dir):
            continue

        meta = _read_meta(skill_dir)
        skill_md = _read_skill_md(skill_dir)

        slug = meta.get("slug", entry) if meta else entry
        name = skill_md.get("name", entry) if skill_md else entry
        description = skill_md.get("description", "") if skill_md else ""

        py_files = [f for f in os.listdir(scripts_dir)
                    if f.endswith(".py") and not f.startswith("__")]
        cli_file = None
        for pf in py_files:
            if pf.endswith("_cli.py") or pf == "cli.py":
                cli_file = pf
                break
        if not cli_file and py_files:
            cli_file = py_files[0]

        registry[slug] = {
            "slug": slug,
            "name": name,
            "description": description,
            "directory": skill_dir,
            "scripts_dir": scripts_dir,
            "cli_file": cli_file,
            "cli_path": os.path.join(scripts_dir, cli_file) if cli_file else None,
            "module_name": cli_file.replace(".py", "") if cli_file else None,
            "version": meta.get("version", "1.0.0") if meta else "1.0.0",
            "exports": {},
        }

    return registry


def load_all_skills(force_reload: bool = False) -> Dict[str, Dict[str, Any]]:
    """加载所有 skill，将 scripts 目录加入 sys.path 并导入模块"""
    global _skill_registry, _module_cache, _loaded

    if _loaded and not force_reload:
        return _skill_registry

    _skill_registry = _discover_skills()
    _module_cache = {}

    for slug, info in _skill_registry.items():
        scripts_dir = info["scripts_dir"]
        if scripts_dir not in sys.path:
            sys.path.insert(0, scripts_dir)

        cli_path = info.get("cli_path")
        module_name = info.get("module_name")
        if cli_path and module_name and os.path.exists(cli_path):
            try:
                spec = importlib.util.spec_from_file_location(module_name, cli_path)
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                    _module_cache[slug] = module
                    info["exports"] = _extract_exports(module)
            except Exception as e:
                print(f"[skill_loader] 加载 {slug} 失败: {e}")

    _loaded = True
    return _skill_registry


def _extract_exports(module) -> Dict[str, Dict[str, Any]]:
    """提取模块中导出的公共函数"""
    exports = {}
    for attr_name in dir(module):
        if attr_name.startswith("_"):
            continue
        attr = getattr(module, attr_name)
        if callable(attr) and not isinstance(attr, type):
            try:
                import inspect
                sig = inspect.signature(attr)
                params = {}
                for pname, param in sig.parameters.items():
                    if pname in ("self", "cls"):
                        continue
                    param_info = {"required": param.default is inspect.Parameter.empty}
                    if param.default is not inspect.Parameter.empty:
                        param_info["default"] = repr(param.default)
                    if param.annotation is not inspect.Parameter.empty:
                        param_info["type"] = str(param.annotation)
                    params[pname] = param_info
                exports[attr_name] = {
                    "callable": True,
                    "params": params,
                    "doc": (attr.__doc__ or "").strip()[:500],
                }
            except Exception:
                exports[attr_name] = {"callable": True}
    return exports


def get_skill(slug: str) -> Optional[Dict[str, Any]]:
    """获取指定 skill 的信息"""
    if not _loaded:
        load_all_skills()
    return _skill_registry.get(slug)


def get_module(slug: str) -> Optional[Any]:
    """获取指定 skill 的 Python 模块对象"""
    if not _loaded:
        load_all_skills()
    return _module_cache.get(slug)


def call_skill_function(slug: str, func_name: str, *args, **kwargs) -> Any:
    """调用指定 skill 的指定函数"""
    module = get_module(slug)
    if module is None:
        raise ImportError(f"Skill '{slug}' 未加载")
    func = getattr(module, func_name, None)
    if func is None:
        raise AttributeError(f"Skill '{slug}' 中没有函数 '{func_name}'")
    return func(*args, **kwargs)


def list_skills() -> List[Dict[str, str]]:
    """列出所有已注册的 skill"""
    if not _loaded:
        load_all_skills()
    return [
        {
            "slug": info["slug"],
            "name": info["name"],
            "description": info["description"],
            "version": info["version"],
            "function_count": len(info.get("exports", {})),
        }
        for info in _skill_registry.values()
    ]


def generate_openai_tools() -> List[Dict[str, Any]]:
    """自动从 skill 注册表生成 OpenAI function call 格式的 tool 定义"""
    if not _loaded:
        load_all_skills()

    tools = []
    for slug, info in _skill_registry.items():
        for func_name, func_info in info.get("exports", {}).items():
            if not func_info.get("callable"):
                continue

            properties = {}
            required = []
            for pname, pinfo in func_info.get("params", {}).items():
                prop_def = {"description": f"{pname} 参数"}
                if "type" in pinfo:
                    type_str = pinfo["type"]
                    if "int" in type_str:
                        prop_def["type"] = "integer"
                    elif "float" in type_str:
                        prop_def["type"] = "number"
                    elif "bool" in type_str:
                        prop_def["type"] = "boolean"
                    else:
                        prop_def["type"] = "string"
                else:
                    prop_def["type"] = "string"
                properties[pname] = prop_def
                if pinfo.get("required"):
                    required.append(pname)

            tool_name = f"{slug}__{func_name}"
            doc = func_info.get("doc", f"{info['name']} - {func_name}")

            tools.append({
                "type": "function",
                "function": {
                    "name": tool_name,
                    "description": f"[{info['name']}] {doc}",
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "required": required,
                    },
                },
            })

    return tools


def reload_skills() -> Dict[str, Dict[str, Any]]:
    """强制重新加载所有 skill"""
    return load_all_skills(force_reload=True)


def get_skill_stats() -> Dict[str, Any]:
    """获取 skill 加载统计信息"""
    if not _loaded:
        load_all_skills()
    total_functions = sum(
        len(info.get("exports", {})) for info in _skill_registry.values()
    )
    return {
        "skill总数": len(_skill_registry),
        "函数总数": total_functions,
        "已加载模块数": len(_module_cache),
        "skill列表": [
            {
                "slug": info["slug"],
                "name": info["name"],
                "函数数": len(info.get("exports", {})),
            }
            for info in _skill_registry.values()
        ],
    }


# ==================== Function Call 桥接层 ====================

class SkillFunctionCallBridge:
    """
    Function Call 桥接层
    负责将 OpenAI function call 请求分发到对应的 skill 函数执行
    支持同步调用、参数校验、错误处理、结果格式化
    """

    def __init__(self):
        if not _loaded:
            load_all_skills()
        self._tool_index = self._build_tool_index()

    def _build_tool_index(self) -> Dict[str, Dict[str, Any]]:
        """构建 tool_name -> (slug, func_name, func_info) 的索引"""
        index = {}
        for slug, info in _skill_registry.items():
            for func_name, func_info in info.get("exports", {}).items():
                if not func_info.get("callable"):
                    continue
                tool_name = f"{slug}__{func_name}"
                index[tool_name] = {
                    "slug": slug,
                    "func_name": func_name,
                    "func_info": func_info,
                    "skill_name": info["name"],
                }
        return index

    def get_tools(self) -> List[Dict[str, Any]]:
        """获取所有可用的 OpenAI tool 定义"""
        return generate_openai_tools()

    def get_tool_by_name(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """根据 tool_name 获取 tool 定义"""
        return self._tool_index.get(tool_name)

    def list_tool_names(self) -> List[str]:
        """列出所有可用的 tool 名称"""
        return sorted(self._tool_index.keys())

    def dispatch(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        分发 function call 到对应的 skill 函数执行

        参数:
            tool_name: 工具名称，格式为 "{slug}__{func_name}"
            arguments: 函数参数

        返回:
            {"success": True, "result": ..., "tool_name": ..., "skill": ...}
            或
            {"success": False, "error": ..., "tool_name": ...}
        """
        tool_info = self._tool_index.get(tool_name)
        if tool_info is None:
            return {
                "success": False,
                "error": f"未知工具: {tool_name}",
                "tool_name": tool_name,
                "available_tools": self.list_tool_names()[:10],
            }

        slug = tool_info["slug"]
        func_name = tool_info["func_name"]

        try:
            result = call_skill_function(slug, func_name, **arguments)
            return {
                "success": True,
                "result": self._serialize_result(result),
                "tool_name": tool_name,
                "skill": tool_info["skill_name"],
                "function": func_name,
            }
        except TypeError as e:
            return {
                "success": False,
                "error": f"参数错误: {e}",
                "tool_name": tool_name,
                "expected_params": tool_info["func_info"].get("params", {}),
            }
        except Exception as e:
            traceback.print_exc()
            return {
                "success": False,
                "error": f"执行失败: {e}",
                "tool_name": tool_name,
            }

    def dispatch_batch(self, tool_calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        批量分发多个 function call

        参数:
            tool_calls: [{"name": "xxx", "arguments": {...}}, ...]

        返回:
            [{"success": True/False, ...}, ...]
        """
        results = []
        for tc in tool_calls:
            tool_name = tc.get("name", "")
            arguments = tc.get("arguments", {})
            if isinstance(arguments, str):
                try:
                    arguments = json.loads(arguments)
                except json.JSONDecodeError:
                    arguments = {}
            results.append(self.dispatch(tool_name, arguments))
        return results

    @staticmethod
    def _serialize_result(result: Any) -> Any:
        """将函数返回值序列化为 JSON 兼容格式"""
        if result is None:
            return None
        if isinstance(result, (str, int, float, bool, list, dict)):
            return result
        if hasattr(result, "to_dict"):
            return result.to_dict()
        if hasattr(result, "to_json"):
            return result.to_json()
        try:
            import pandas as pd
            if isinstance(result, pd.DataFrame):
                return result.to_dict(orient="records")
            if isinstance(result, pd.Series):
                return result.to_dict()
        except ImportError:
            pass
        try:
            return str(result)
        except Exception:
            return "无法序列化的结果"

    def get_tool_schema(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """获取指定 tool 的完整 schema"""
        tools = self.get_tools()
        for tool in tools:
            if tool["function"]["name"] == tool_name:
                return tool
        return None

    def search_tools(self, keyword: str) -> List[Dict[str, Any]]:
        """按关键词搜索 tool"""
        keyword_lower = keyword.lower()
        results = []
        for tool in self.get_tools():
            name = tool["function"]["name"]
            desc = tool["function"]["description"]
            if keyword_lower in name.lower() or keyword_lower in desc.lower():
                results.append({
                    "name": name,
                    "description": desc,
                    "parameters": tool["function"]["parameters"],
                })
        return results


_bridge: Optional[SkillFunctionCallBridge] = None


def get_bridge() -> SkillFunctionCallBridge:
    """获取全局 Function Call 桥接层单例"""
    global _bridge
    if _bridge is None:
        _bridge = SkillFunctionCallBridge()
    return _bridge


def dispatch_function_call(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """快捷方法：分发单个 function call"""
    return get_bridge().dispatch(tool_name, arguments)


def dispatch_function_calls(tool_calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """快捷方法：批量分发 function call"""
    return get_bridge().dispatch_batch(tool_calls)