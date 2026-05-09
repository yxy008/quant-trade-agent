#!/usr/bin/env python3
"""
MySQL数据库工具模块 - 连接管理 / 表初始化 / 查询辅助
"""
import os
import json
import threading
from datetime import datetime

try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pymysql = None

DB_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db_config.json")

DEFAULT_DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "127.0.0.1"),
    "port": int(os.environ.get("DB_PORT", 3306)),
    "user": os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD", "123456"),
    "database": os.environ.get("DB_NAME", "quant_agent"),
    "charset": "utf8mb4"
}

_connection_pool = {}
_pool_lock = threading.Lock()


def load_db_config():
    """加载数据库配置"""
    try:
        if os.path.exists(DB_CONFIG_PATH):
            with open(DB_CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
                merged = {**DEFAULT_DB_CONFIG, **config}
                return merged
    except Exception:
        pass
    return DEFAULT_DB_CONFIG.copy()


def save_db_config(config):
    """保存数据库配置"""
    with open(DB_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def get_connection():
    """获取MySQL数据库连接"""
    if pymysql is None:
        raise ImportError("请先安装pymysql: pip install pymysql")

    config = load_db_config()
    thread_id = threading.get_ident()

    with _pool_lock:
        if thread_id in _connection_pool:
            conn = _connection_pool[thread_id]
            try:
                conn.ping(reconnect=True)
                return conn
            except Exception:
                pass

        conn = pymysql.connect(
            host=config["host"],
            port=config["port"],
            user=config["user"],
            password=config["password"],
            database=config["database"],
            charset=config["charset"],
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False
        )
        _connection_pool[thread_id] = conn
        return conn


def close_connection():
    """关闭当前线程的数据库连接"""
    thread_id = threading.get_ident()
    with _pool_lock:
        if thread_id in _connection_pool:
            try:
                _connection_pool[thread_id].close()
            except Exception:
                pass
            del _connection_pool[thread_id]


def execute_query(sql, params=None, fetch_one=False):
    """执行查询并返回结果"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            if fetch_one:
                return cursor.fetchone()
            return cursor.fetchall()
    except Exception as e:
        conn.rollback()
        raise e


def execute_update(sql, params=None):
    """执行更新操作（INSERT/UPDATE/DELETE）"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            last_id = cursor.lastrowid
        conn.commit()
        return last_id
    except Exception as e:
        conn.rollback()
        raise e


def execute_many(sql, params_list):
    """批量执行"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.executemany(sql, params_list)
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e


def init_all_tables():
    """初始化所有数据库表"""
    if pymysql is None:
        raise ImportError("请先安装pymysql: pip install pymysql")

    config = load_db_config()

    # 先连接不指定数据库，创建数据库
    conn = pymysql.connect(
        host=config["host"],
        port=config["port"],
        user=config["user"],
        password=config["password"],
        charset=config["charset"]
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{config['database']}` "
                f"DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conn.commit()
    finally:
        conn.close()

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # 用户表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    email VARCHAR(100) DEFAULT '',
                    role VARCHAR(20) DEFAULT 'user',
                    status TINYINT DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    last_login DATETIME DEFAULT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # 会话表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    token VARCHAR(64) NOT NULL UNIQUE,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # 定时任务表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    task_type VARCHAR(50) NOT NULL,
                    config JSON,
                    schedule_type VARCHAR(20) NOT NULL DEFAULT 'daily',
                    schedule_time VARCHAR(10) NOT NULL DEFAULT '09:00',
                    enabled TINYINT NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # 任务执行日志表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS task_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    task_id INT NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'running',
                    result JSON,
                    error TEXT,
                    started_at DATETIME NOT NULL,
                    finished_at DATETIME DEFAULT NULL,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # 持仓表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS holdings (
                    id VARCHAR(16) PRIMARY KEY,
                    user_id INT NOT NULL DEFAULT 1,
                    symbol VARCHAR(10) NOT NULL,
                    name VARCHAR(50) DEFAULT '',
                    buy_date VARCHAR(20) NOT NULL,
                    buy_price DECIMAL(10, 3) NOT NULL,
                    lots INT NOT NULL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # 回测记录表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS backtest_records (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL DEFAULT 1,
                    symbol VARCHAR(10) NOT NULL,
                    strategy VARCHAR(50) NOT NULL,
                    metrics JSON,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # AI对话历史表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_chat_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    content TEXT NOT NULL,
                    mode VARCHAR(30) DEFAULT 'chat',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

        conn.commit()
        print("数据库表初始化完成")
    except Exception as e:
        conn.rollback()
        raise e


def test_connection():
    """测试数据库连接"""
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
        return True, "数据库连接成功"
    except Exception as e:
        return False, str(e)


get_db_connection = get_connection
