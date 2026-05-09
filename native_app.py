#!/usr/bin/env python3
"""
量化交易系统 - 原生桌面应用
使用 pywebview 创建原生窗口，内嵌 Web 前端，无需浏览器
"""
import os
import sys
import json
import threading
import time
import signal

AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AGENT_DIR)

# 全局变量
_flask_thread = None
_server_ready = False
_server_port = 5000


def start_flask_server(port=5000, host="127.0.0.1"):
    """在后台线程启动 Flask 服务"""
    global _server_ready, _server_port
    _server_port = port

    from app import app

    # 初始化数据库表
    try:
        from db_utils import init_all_tables
        init_all_tables()
        print("[原生桌面] 数据库表初始化完成")
    except Exception as e:
        print(f"[原生桌面] 数据库初始化失败: {e}")
        print("[原生桌面] 请确保MySQL已启动并配置正确")

    # 禁用 Flask 的 reloader 和 debug 模式
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.WARNING)

    # 在启动前标记就绪
    def set_ready():
        global _server_ready
        _server_ready = True

    import flask
    original_run = flask.Flask.run

    def patched_run(self, *args, **kwargs):
        set_ready()
        original_run(self, *args, **kwargs)

    flask.Flask.run = patched_run

    app.run(host=host, port=port, debug=False, use_reloader=False)


def wait_for_server(timeout=10):
    """等待 Flask 服务就绪"""
    global _server_ready
    start = time.time()
    while not _server_ready:
        if time.time() - start > timeout:
            return False
        time.sleep(0.1)
    return True


def create_native_window():
    """创建原生桌面窗口"""
    try:
        import webview
    except ImportError:
        print("=" * 60)
        print("  错误: pywebview 未安装")
        print("  请运行: pip install pywebview")
        print("=" * 60)
        sys.exit(1)

    url = f"http://127.0.0.1:{_server_port}"

    window_title = "量化交易系统 v1.0"

    # 获取屏幕分辨率，自适应窗口大小
    try:
        import ctypes
        user32 = ctypes.windll.user32
        screen_w = user32.GetSystemMetrics(0)
        screen_h = user32.GetSystemMetrics(1)
    except Exception:
        screen_w, screen_h = 1920, 1080

    # 窗口占屏幕的75%，最小1024x680
    win_w = max(1024, int(screen_w * 0.75))
    win_h = max(680, int(screen_h * 0.75))

    window_config = {
        "width": win_w,
        "height": win_h,
        "min_size": (1024, 680),
        "resizable": True,
        "fullscreen": False,
        "text_select": True,
    }

    config_path = os.path.join(AGENT_DIR, "window_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                saved = json.load(f)
                window_config.update(saved)
        except Exception:
            pass

    print(f"[原生桌面] 启动窗口: {window_title}")
    print(f"[原生桌面] 分辨率: {window_config['width']}x{window_config['height']}")

    # 创建原生窗口
    window = webview.create_window(
        title=window_title,
        url=url,
        width=window_config["width"],
        height=window_config["height"],
        min_size=window_config["min_size"],
        resizable=window_config["resizable"],
        fullscreen=window_config["fullscreen"],
        text_select=window_config["text_select"],
        confirm_close=True,
    )

    # 窗口关闭时保存配置
    def on_closing():
        try:
            config = {
                "width": window.width,
                "height": window.height,
            }
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        return True

    window.events.closing += on_closing

    webview.start(debug=False, http_server=False)


def main():
    global _flask_thread

    import argparse
    parser = argparse.ArgumentParser(description="量化交易系统 - 原生桌面版")
    parser.add_argument("--port", type=int, default=5000, help="服务端口 (默认: 5000)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="绑定地址 (默认: 127.0.0.1)")
    args = parser.parse_args()

    print("=" * 60)
    print("  量化交易系统 v1.0 - 原生桌面版")
    print("  A股量化分析平台")
    print("=" * 60)
    print()

    # 启动 Flask 后台服务
    print("[原生桌面] 正在启动后台服务...")
    _flask_thread = threading.Thread(
        target=start_flask_server,
        args=(args.port, args.host),
        daemon=True,
    )
    _flask_thread.start()

    # 等待服务就绪
    if not wait_for_server():
        print("[原生桌面] 错误: 服务启动超时")
        sys.exit(1)

    print(f"[原生桌面] 后台服务已就绪: http://{args.host}:{args.port}")
    print()

    # 创建原生窗口
    create_native_window()


if __name__ == "__main__":
    main()
