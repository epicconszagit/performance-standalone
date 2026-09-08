import secrets
from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from werkzeug.security import generate_password_hash

from ..extensions import db
from ..models import Employee, User
from ..utils.company import generate_employee_id_code
from ..utils.email import send_email
from ..utils.sms import send_sms
from ..utils.validation import EMAIL_REGEX
from .generic import current_user
from .pending_users import ADMIN_EMPLOYEE_ROLES

employees_onboard_bp = Blueprint("employees_onboard", __name__)


@employees_onboard_bp.route("/employees/onboard", methods=["POST"])
@jwt_required()
def onboard_employee():
    """Admin-only: creates a new Staff member AND a login account for them in
    one step, then sends the login credentials by email and/or SMS - the
    "Add Staff" counterpart to the pending-user approval flow.
    """
    admin = current_user()
    if admin is None or admin.role != "admin":
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    role = data.get("role") or "Staff Member"

    if not full_name or not email:
        return jsonify({"error": "full name and email are required"}), 400
    if not EMAIL_REGEX.match(email):
        return jsonify({"error": "Please enter a valid email address."}), 400
    if User.query.filter_by(email=email).first() or Employee.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    hire_date_raw = data.get("hire_date") or ""
    hire_date = date.fromisoformat(hire_date_raw) if hire_date_raw else None

    temp_password = secrets.token_urlsafe(8)
    user = User(
        email=email,
        personal_email=email,
        password_hash=generate_password_hash(temp_password),
        full_name=full_name,
        phone=phone,
        role="admin" if role in ADMIN_EMPLOYEE_ROLES else "user",
        status="active",
    )
    db.session.add(user)
    db.session.flush()

    employee = Employee(
        full_name=full_name,
        email=email,
        phone=phone,
        user_id=user.id,
        department_id=data.get("department_id") or "",
        department_name=data.get("department_name") or "",
        position=data.get("position") or "",
        role=role,
        manager_id=data.get("manager_id") or "",
        status=data.get("status") or "active",
        hire_date=hire_date,
        employee_id_code=(data.get("employee_id_code") or "").strip() or generate_employee_id_code(),
        invited=True,
    )
    db.session.add(employee)
    db.session.commit()

    message = (
        f"Hi {full_name}, an account has been created for you. "
        f"Login email: {email} - temporary password: {temp_password}. "
        f"Please log in and consider resetting your password."
    )
    email_sent = send_email(to=email, subject="Your account has been created", body=message)
    sms_sent = send_sms(to=phone, message=message) if phone else False

    return jsonify({
        "employee": employee.to_dict(),
        "user": user.to_public_dict(),
        "notified": {"email": email_sent, "sms": sms_sent},
    }), 201
