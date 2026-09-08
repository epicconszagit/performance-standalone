import os

from apscheduler.schedulers.background import BackgroundScheduler

from .jobs.birthdays import run_birthday_check

_scheduler = None


def _run_birthday_check_job(app):
    with app.app_context():
        run_birthday_check()


def init_scheduler(app):
    """Starts a background scheduler that runs daily jobs (currently just the
    birthday check) inside the Flask app - no separate worker process needed.

    In dev (`python run.py`, app.debug=True), Werkzeug's reloader re-executes
    this whole app factory in a "monitor" process (which never serves
    requests) in addition to the real worker process it spawns; only the
    worker gets WERKZEUG_RUN_MAIN=true. Skipping the scheduler in the monitor
    keeps the job from being scheduled twice, which would otherwise send
    every notification twice. In production (app.debug=False - see
    config.py's DEBUG), there is no reloader/monitor process, so the
    scheduler always starts.

    Caveat: this assumes a single always-on worker process. A production
    deployment with multiple workers (e.g. `gunicorn -w 4`) would start this
    scheduler once per worker, running the job that many times a day - use a
    single worker, a dedicated process, or an external cron hitting
    /api/admin/run-birthday-check instead if you need more than one worker.
    """
    global _scheduler
    if _scheduler is not None:
        return
    if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(
        _run_birthday_check_job,
        "cron",
        hour=7,
        minute=0,
        args=[app],
        id="birthday_check",
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
