#!/usr/bin/env python3
"""
量化交易系统 - 桌面启动器
启动 Flask 服务后自动打开默认浏览器，提供类似原生桌面应用的体验
可作为 PyInstaller 打包入口或直接运行
"""
import os
import sys
import time
import threading
import webbrowser

AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AGENT_DIR)


def open_browser(port, delay=1.5):
    """延迟打开浏览器"""
    time.sleep(delay)
    url = f"http://127.0.0.1:{port}"
    print(f"[桌面启动器] 正在打开浏览器: {url}")
    webbrowser.open(url)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="量化交易系统桌面版")
    parser.add_argument("--port", type=int, default=5000, help="服务端口 (默认: 5000)")
    parser.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="绑定地址 (默认: 127.0.0.1)")
    args = parser.parse_args()

    print("=" * 60)
    print("  量化交易系统 v1.0")
    print("  A股量化分析平台")
    print("=" * 60)
    print()

    # 自动打开浏览器
    if not args.no_browser:
        threading.Thread(target=open_browser, args=(args.port,), daemon=True).start()

    # 启动 Flask 应用
    from app import app

    print(f"[桌面启动器] 服务启动中...")
    print(f"[桌面启动器] 访问地址: http://{args.host}:{args.port}")
    print(f"[桌面启动器] 按 Ctrl+C 停止服务")
    print()

    app.run(host=args.host, port=args.port, debug=False)


if __name__ == "__main__":
    main()
