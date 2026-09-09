from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Department, Employee, User
from ..utils.company import EMAIL_DOMAIN, generate_employee_email_base, generate_employee_id_code
from ..utils.email import send_email
from ..utils.sms import normalize_phone_number, send_sms
from .generic import current_user

pending_users_bp = Blueprint("pending_users", __name__)

ADMIN_EMPLOYEE_ROLES = {"Super Administrator", "Administrator", "Director of Operations"}


def _require_admin():
    user = current_user()
    return user if user is not None and user.role == "admin" else None


def _generate_unique_company_email(full_name):
    base = generate_employee_email_base(full_name)
    candidate = f"{base}@{EMAIL_DOMAIN}"
    suffix = 1
    while User.query.filter_by(email=candidate).first() or Employee.query.filter_by(email=candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}@{EMAIL_DOMAIN}"
    return candidate


@pending_users_bp.route("/pending-users", methods=["GET"])
@jwt_required()
def list_pending_users():
    if _require_admin() is None:
        return jsonify({"error": "forbidden"}), 403
    users = User.query.filter_by(status="pending").order_by(User.created_date.desc()).all()
    return jsonify([u.to_public_dict() for u in users])


@pending_users_bp.route("/pending-users/<user_id>/approve", methods=["POST"])
@jwt_required()
def approve_user(user_id):
    if _require_admin() is None:
        return jsonify({"error": "forbidden"}), 403

    target = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    department_id = data.get("department_id") or ""
    department = Department.query.get(department_id) if department_id else None
    employee_role = data.get("role") or "Staff Member"
    hire_date_raw = data.get("hire_date") or ""
    hire_date = date.fromisoformat(hire_date_raw) if hire_date_raw else None
    full_name = data.get("full_name") or target.full_name or target.email

    # Replace whatever email they signed up with with a standard company
    # address - this becomes their login going forward too.
    company_email = _generate_unique_company_email(full_name)

    employee = Employee(
        full_name=full_name,
        email=company_email,
        phone=normalize_phone_number(data.get("phone") or target.phone or ""),
        user_id=target.id,
        department_id=department_id,
        department_name=department.name if department else "",
        position=data.get("position") or target.requested_position or "",
        role=employee_role,
        status="active",
        hire_date=hire_date,
        employee_id_code=generate_employee_id_code(),
    )
    db.session.add(employee)

    target.email = company_email
    target.full_name = full_name
    target.status = "active"
    if employee_role in ADMIN_EMPLOYEE_ROLES:
        target.role = "admin"

    db.session.commit()

    notify_message = (
        f"Hi {full_name}, your account has been approved on the EPIC TASK PERFORMANCE TRACKING SYSTEM. "
        f"Your new login email is {company_email} - use your existing password to log in."
    )
    email_sent = False
    if target.personal_email:
        email_sent = send_email(to=target.personal_email, subject="Your EPIC TASK PERFORMANCE TRACKING SYSTEM account has been approved", body=notify_message)
    sms_sent = send_sms(to=employee.phone, message=notify_message) if employee.phone else False

    return jsonify({
        "user": target.to_public_dict(),
        "employee": employee.to_dict(),
        "notified": {"email": email_sent, "sms": sms_sent},
    })


@pending_users_bp.route("/pending-users/<user_id>/reject", methods=["POST"])
@jwt_required()
def reject_user(user_id):
    if _require_admin() is None:
        return jsonify({"error": "forbidden"}), 403
    target = User.query.get_or_404(user_id)
    db.session.delete(target)
    db.session.commit()
    return jsonify({"ok": True})
