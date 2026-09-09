from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..models import Employee, User
from ..utils.email import send_email

email_bp = Blueprint("email", __name__)


@email_bp.route("/send-email", methods=["POST"])
@jwt_required()
def send_email_route():
    data = request.get_json(silent=True) or {}
    to_addr = (data.get("to") or "").strip()

    if to_addr:
        # Prioritize personal email while company domains are pending
        emp = Employee.query.filter((Employee.email == to_addr) | (Employee.personal_email == to_addr)).first()
        if emp and emp.personal_email:
            to_addr = emp.personal_email.strip()
        else:
            u = User.query.filter((User.email == to_addr) | (User.personal_email == to_addr)).first()
            if u and u.personal_email:
                to_addr = u.personal_email.strip()

    send_email(to=to_addr, subject=data.get("subject"), body=data.get("body"))
    return jsonify({"ok": True})
