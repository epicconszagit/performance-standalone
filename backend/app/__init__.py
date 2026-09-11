import os
from datetime import timedelta

from flask import Flask, send_from_directory
from flask_cors import CORS

from .config import BASE_DIR, Config
from .extensions import db, jwt, migrate


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(
        seconds=app.config["JWT_ACCESS_TOKEN_EXPIRES_SECONDS"]
    )

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app)

    from . import models  # noqa: F401  (registers models with SQLAlchemy)

    # Self-healing database check: ensure new columns and tables exist automatically
    with app.app_context():
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            if "tasks" in tables:
                task_cols = [c["name"] for c in inspector.get_columns("tasks")]
                if "priority" not in task_cols:
                    db.session.execute(text("ALTER TABLE tasks ADD COLUMN priority VARCHAR(20) DEFAULT 'Medium'"))
                if "weight" not in task_cols:
                    db.session.execute(text("ALTER TABLE tasks ADD COLUMN weight INTEGER DEFAULT 2"))
                db.session.commit()
            if "todo_items" not in tables:
                from .models import TodoItem
                TodoItem.__table__.create(db.engine, checkfirst=True)
        except Exception as e:
            app.logger.warning("Database self-healing notice: %s", e)

    from .auth.routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    from .api import build_entities_blueprint
    app.register_blueprint(build_entities_blueprint(), url_prefix="/api")

    from .api.uploads import uploads_bp
    app.register_blueprint(uploads_bp, url_prefix="/api")

    from .api.pending_users import pending_users_bp
    app.register_blueprint(pending_users_bp, url_prefix="/api")

    from .api.employees_onboard import employees_onboard_bp
    app.register_blueprint(employees_onboard_bp, url_prefix="/api")

    from .api.employees_profile import employees_profile_bp
    app.register_blueprint(employees_profile_bp, url_prefix="/api")

    from .api.admin_jobs import admin_jobs_bp
    app.register_blueprint(admin_jobs_bp, url_prefix="/api")

    from .api.email_route import email_bp
    app.register_blueprint(email_bp, url_prefix="/api")

    from .api.meetings_batch import meetings_batch_bp
    app.register_blueprint(meetings_batch_bp, url_prefix="/api")

    from .scheduler import init_scheduler
    init_scheduler(app)

    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        # as_attachment forces a download rather than inline rendering -
        # without this, an uploaded .html/.svg could execute as script in
        # the app's own origin (stored XSS) when opened directly. <img>/file
        # previews are unaffected since Content-Disposition only applies to
        # top-level navigation, not subresource loads.
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=True)

    @app.route("/api/health")
    def health():
        return {"status": "ok"}

    # If the frontend has been built (`npm run build` inside frontend/), serve
    # it straight from this same Flask app/domain - avoids running a second
    # server and avoids CORS entirely in production. In dev, this directory
    # doesn't exist (Vite's own dev server handles the frontend instead), so
    # these routes are simply never registered.
    frontend_dist = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))
    if os.path.isdir(frontend_dist):
        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path):
            full_path = os.path.join(frontend_dist, path)
            if path and os.path.isfile(full_path):
                return send_from_directory(frontend_dist, path)
            # Anything else (a client-side route like /tasks, or a bare "/")
            # falls back to index.html so React Router can handle it.
            return send_from_directory(frontend_dist, "index.html")

    return app
