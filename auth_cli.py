#!/usr/bin/env python3
"""
用户认证模块 - 注册 / 登录 / 登出 / 会话管理
"""
import os
import hashlib
import secrets
import string
from datetime import datetime, timedelta

from db_utils import execute_query, execute_update, get_connection


def _hash_password(password, salt=None):
    """密码哈希（SHA256 + 盐值）"""
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256()
    h.update((password + salt).encode("utf-8"))
    return h.hexdigest(), salt


def _generate_token():
    """生成会话令牌"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(64))


def register_user(username, password, email=""):
    """注册新用户"""
    if not username or len(username) < 2:
        return {"success": False, "error": "用户名至少2个字符"}

    if not password or len(password) < 6:
        return {"success": False, "error": "密码至少6个字符"}

    existing = execute_query(
        "SELECT id FROM users WHERE username = %s",
        (username,), fetch_one=True
    )
    if existing:
        return {"success": False, "error": "用户名已存在"}

    password_hash, salt = _hash_password(password)
    combined_hash = f"{salt}:{password_hash}"

    user_id = execute_update(
        "INSERT INTO users (username, password_hash, email) VALUES (%s, %s, %s)",
        (username, combined_hash, email)
    )

    return {
        "success": True,
        "message": "注册成功",
        "user_id": user_id,
        "username": username
    }


def login_user(username, password):
    """用户登录"""
    user = execute_query(
        "SELECT id, username, password_hash, role, status FROM users WHERE username = %s",
        (username,), fetch_one=True
    )

    if not user:
        return {"success": False, "error": "用户名或密码错误"}

    if user["status"] != 1:
        return {"success": False, "error": "账号已被禁用"}

    parts = user["password_hash"].split(":", 1)
    if len(parts) != 2:
        return {"success": False, "error": "密码数据异常"}

    salt, stored_hash = parts
    computed_hash, _ = _hash_password(password, salt)

    if computed_hash != stored_hash:
        return {"success": False, "error": "用户名或密码错误"}

    # 生成会话令牌
    token = _generate_token()
    expires_at = datetime.now() + timedelta(days=7)

    execute_update(
        "INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, %s)",
        (user["id"], token, expires_at.strftime('%Y-%m-%d %H:%M:%S'))
    )

    # 更新最后登录时间
    execute_update(
        "UPDATE users SET last_login = NOW() WHERE id = %s",
        (user["id"],)
    )

    return {
        "success": True,
        "message": "登录成功",
        "token": token,
        "user_id": user["id"],
        "username": user["username"],
        "role": user["role"]
    }


def logout_user(token):
    """用户登出"""
    execute_update("DELETE FROM sessions WHERE token = %s", (token,))
    return {"success": True, "message": "已登出"}


def validate_token(token):
    """验证会话令牌，返回用户信息或None"""
    if not token:
        return None

    session = execute_query(
        """SELECT s.user_id, s.expires_at, u.username, u.role
           FROM sessions s JOIN users u ON s.user_id = u.id
           WHERE s.token = %s AND u.status = 1""",
        (token,), fetch_one=True
    )

    if not session:
        return None

    if session["expires_at"] < datetime.now():
        execute_update("DELETE FROM sessions WHERE token = %s", (token,))
        return None

    return {
        "user_id": session["user_id"],
        "username": session["username"],
        "role": session["role"]
    }


def get_user_info(user_id):
    """获取用户信息"""
    user = execute_query(
        "SELECT id, username, email, role, created_at, last_login FROM users WHERE id = %s",
        (user_id,), fetch_one=True
    )
    if user:
        user["created_at"] = user["created_at"].strftime('%Y-%m-%d %H:%M:%S') if user["created_at"] else ""
        user["last_login"] = user["last_login"].strftime('%Y-%m-%d %H:%M:%S') if user["last_login"] else ""
    return user


def change_password(user_id, old_password, new_password):
    """修改密码"""
    user = execute_query(
        "SELECT password_hash FROM users WHERE id = %s",
        (user_id,), fetch_one=True
    )
    if not user:
        return {"success": False, "error": "用户不存在"}

    parts = user["password_hash"].split(":", 1)
    if len(parts) != 2:
        return {"success": False, "error": "密码数据异常"}

    salt, stored_hash = parts
    computed_hash, _ = _hash_password(old_password, salt)

    if computed_hash != stored_hash:
        return {"success": False, "error": "原密码错误"}

    if not new_password or len(new_password) < 6:
        return {"success": False, "error": "新密码至少6个字符"}

    new_hash, new_salt = _hash_password(new_password)
    combined_hash = f"{new_salt}:{new_hash}"

    execute_update(
        "UPDATE users SET password_hash = %s WHERE id = %s",
        (combined_hash, user_id)
    )

    return {"success": True, "message": "密码修改成功"}
