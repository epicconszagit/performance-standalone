from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..jobs.birthdays import run_birthday_check
from .generic import current_user

admin_jobs_bp = Blueprint("admin_jobs", __name__)


@admin_jobs_bp.route("/admin/run-birthday-check", methods=["POST"])
@jwt_required()
def trigger_birthday_check():
    """Admin-only manual run of the daily birthday check - lets an admin
    recover a missed notification (e.g. server was down) without waiting
    for tomorrow, and is the easiest way to verify the job works.
    """
    user = current_user()
    if user is None or user.role != "admin":
        return jsonify({"error": "forbidden"}), 403
    result = run_birthday_check()
    return jsonify(result)
