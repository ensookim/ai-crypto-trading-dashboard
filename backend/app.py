from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")  # backend/.env 강제 로드
from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_bcrypt import Bcrypt
import threading
import time
import logging

from backend.config import settings
from backend.utils.logging import setup_logging
from backend.utils.db import init_db
from backend.auth.routes import create_auth_blueprint
from backend.trading.bot import TradingBot

setup_logging()
log = logging.getLogger(__name__)

socketio = SocketIO(cors_allowed_origins=settings.cors_origins.split(","))

def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = settings.secret_key
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    CORS(app, supports_credentials=True, origins=settings.cors_origins.split(","))

    bcrypt = Bcrypt(app)
    init_db()
    app.register_blueprint(create_auth_blueprint(bcrypt))

    bot = TradingBot()

    lock = threading.Lock()
    latest_payload = {}

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True})

    @app.get("/api/initial_data")
    def initial_data():
        with lock:
            payload = bot.run()
            latest_payload.update(payload)
        return jsonify(payload)

    def background_loop():
        # Emit updated data every minute boundary (KST)
        prev_min = None
        while True:
            try:
                now_min = time.localtime().tm_min
                if prev_min is None:
                    prev_min = now_min
                time.sleep(1)
                if now_min != prev_min:
                    with lock:
                        payload = bot.run()
                        latest_payload.update(payload)
                    socketio.emit("data_update", payload)
                    prev_min = now_min
            except Exception as e:
                log.exception("background loop error: %s", e)
                time.sleep(5)

    threading.Thread(target=background_loop, daemon=True).start()

    socketio.init_app(app)
    return app

if __name__ == "__main__":
    app = create_app()
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
