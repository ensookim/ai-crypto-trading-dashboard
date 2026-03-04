import sqlite3
import logging
log = logging.getLogger(__name__)
from flask import Blueprint, request, jsonify, session
from flask_bcrypt import Bcrypt
from datetime import datetime
from backend.utils.db import db_conn

auth_bp = Blueprint("auth", __name__, url_prefix="/api")

def _bcrypt() -> Bcrypt:
    # Bcrypt instance is attached to app in app.py and accessible via current_app.extensions,
    # but Flask-Bcrypt provides simple functions. We'll just import Bcrypt where needed in app.py.
    # Here we rely on app context providing `bcrypt` on blueprint via closure in create_blueprints.
    raise RuntimeError("bcrypt not wired")

def create_auth_blueprint(bcrypt: Bcrypt) -> Blueprint:
    def register():
        data = request.get_json(force=True) or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        if not username or not password:
            return jsonify({"message": "username/password required"}), 400

        pw_hash = bcrypt.generate_password_hash(password).decode("utf-8")
        with db_conn() as conn:
            try:
                conn.execute(
                    "INSERT INTO users(username, password_hash, created_at) VALUES(?,?,?)",
                    (username, pw_hash, datetime.utcnow().isoformat()),
                )
            except sqlite3.IntegrityError:
                # UNIQUE(username) 충돌 같은 "진짜 중복"만 409
                return jsonify({"message": "Username already exists"}), 409
            except sqlite3.OperationalError as e:
                # DB 파일/테이블/잠금 등 운영 에러
                log.exception("SQLite operational error during register: %s", e)
                return jsonify({"message": "Database error"}), 500
            except Exception as e:
                # 나머지 에러도 원인 로깅하고 500
                log.exception("Unexpected error during register: %s", e)
                return jsonify({"message": "Server error"}), 500

        return jsonify({"message": "User created successfully"}), 201

    def login():
        data = request.get_json(force=True) or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        if not username or not password:
            return jsonify({"message": "username/password required"}), 400

        with db_conn() as conn:
            row = conn.execute(
                "SELECT password_hash FROM users WHERE username = ?",
                (username,),
            ).fetchone()

        if not row:
            return jsonify({"message": "Invalid credentials"}), 401

        if not bcrypt.check_password_hash(row[0], password):
            return jsonify({"message": "Invalid credentials"}), 401

        session["user"] = username
        return jsonify({"message": "Login successful", "username": username}), 200

    def logout():
        session.pop("user", None)
        return jsonify({"message": "Logged out"}), 200

    def me():
        u = session.get("user")
        if not u:
            return jsonify({"authenticated": False}), 200
        return jsonify({"authenticated": True, "username": u}), 200

    bp = Blueprint("auth_v2", __name__, url_prefix="/api")
    bp.add_url_rule("/register", view_func=register, methods=["POST"])
    bp.add_url_rule("/login", view_func=login, methods=["POST"])
    bp.add_url_rule("/logout", view_func=logout, methods=["POST"])
    bp.add_url_rule("/me", view_func=me, methods=["GET"])
    return bp
