#!/usr/bin/env python3
"""
AI 股票分析智能体 - 主服务入口
集成所有炒股技能，提供 Web 界面
"""
import sys
import os

os.environ['TQDM_DISABLE'] = '1'

from flask import Flask, render_template

from skill_loader import load_all_skills

SKILLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skills")
load_all_skills()

app = Flask(__name__, template_folder="templates", static_folder="static")

from routes import register_routes
register_routes(app)


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    print("=" * 50)
    print("  AI 股票分析智能体启动中...")
    print("  访问地址: http://127.0.0.1:5000")
    print("=" * 50)
    try:
        from db_utils import init_all_tables
        init_all_tables()
        print("  数据库初始化完成")
    except Exception as e:
        print(f"  数据库初始化失败: {e}")
        print("  请确保MySQL已启动并配置正确")
    app.run(host="127.0.0.1", port=5000, debug=False)