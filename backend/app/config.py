import os
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

# Explicit path - don't rely on the current working directory to find .env,
# since that depends on how/where the process was launched from.
load_dotenv(os.path.join(BASE_DIR, ".env"))


class Config:
    # Set to "1" only by run.py's `python run.py` dev path (before create_app()
    # runs) - never set under a production WSGI server (gunicorn etc.), so
    # app.debug reliably reflects "are we the dev reloader" at create_app()
    # time. See scheduler.py for why that matters.
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret-key")
    JWT_ACCESS_TOKEN_EXPIRES_SECONDS = int(
        os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_SECONDS", 60 * 60 * 24 * 7)
    )

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL"
    ) or f"sqlite:///{os.path.join(BASE_DIR, 'app.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    MAX_CONTENT_LENGTH = 250 * 1024 * 1024  # 250MB - big enough for short video attachments
