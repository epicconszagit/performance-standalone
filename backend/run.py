import os

# Must be set before create_app() reads it via Config.DEBUG, and only when
# this file is actually executed directly (not when a production WSGI server
# like gunicorn imports `app` from this module) - see config.py and
# scheduler.py for why this distinction matters.
if __name__ == "__main__":
    os.environ.setdefault("FLASK_DEBUG", "1")

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
