import secrets
from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from werkzeug.security import generate_password_hash

from ..extensions import db
from ..models import Employee, User
from ..utils.company import generate_employee_id_code, generate_unique_company_email
from ..utils.email import send_email
from ..utils.sms import normalize_phone_number, send_sms
from ..utils.validation import parse_flexible_date, validate_registration_email
from .generic import current_user
from .pending_users import ADMIN_EMPLOYEE_ROLES

employees_onboard_bp = Blueprint("employees_onboard", __name__)


@employees_onboard_bp.route("/employees/onboard", methods=["POST"])
@jwt_required()
def onboard_employee():
    """Admin-only: creates a new Staff member AND a login account for them in
    one step, then sends the login credentials to their personal email and/or SMS.
    """
    admin = current_user()
    if admin is None or admin.role != "admin":
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or "").strip()
    personal_email = (data.get("personal_email") or "").strip().lower()
    company_email = (data.get("email") or "").strip().lower()
    phone = normalize_phone_number((data.get("phone") or "").strip())
    role = data.get("role") or "Staff Member"

    if not full_name:
        return jsonify({"error": "Full name is required"}), 400

    if personal_email:
        email_ok, email_err = validate_registration_email(personal_email)
        if not email_ok:
            return jsonify({"error": f"Invalid personal email: {email_err}"}), 400

        existing_user = User.query.filter(
            (db.func.lower(User.email) == personal_email) | (db.func.lower(User.personal_email) == personal_email)
        ).first()
        existing_emp = Employee.query.filter(
            (db.func.lower(Employee.email) == personal_email) | (db.func.lower(Employee.personal_email) == personal_email)
        ).first()
        if existing_user or existing_emp:
            return jsonify({"error": f"An account with this email ('{personal_email}') has already been created."}), 409

    if company_email:
        existing_c_user = User.query.filter(
            (db.func.lower(User.email) == company_email) | (db.func.lower(User.personal_email) == company_email)
        ).first()
        existing_c_emp = Employee.query.filter(
            (db.func.lower(Employee.email) == company_email) | (db.func.lower(Employee.personal_email) == company_email)
        ).first()
        if existing_c_user or existing_c_emp:
            return jsonify({"error": f"An account with company email '{company_email}' already exists."}), 409
    else:
        # Check if an employee with the exact full name already exists
        existing_name = Employee.query.filter(db.func.lower(Employee.full_name) == full_name.lower()).first()
        if existing_name:
            return jsonify({
                "error": f"A staff member with the name '{full_name}' already exists ({existing_name.email}). If this is a different individual, please specify an official company email explicitly."
            }), 409
        company_email = generate_unique_company_email(full_name)

    hire_date_raw = data.get("hire_date") or ""
    hire_date = parse_flexible_date(hire_date_raw)

    temp_password = secrets.token_urlsafe(8)
    user = User(
        email=company_email,
        personal_email=personal_email or company_email,
        password_hash=generate_password_hash(temp_password),
        full_name=full_name,
        phone=phone,
        role="admin" if role in ADMIN_EMPLOYEE_ROLES else "user",
        status="active",
    )
    db.session.add(user)
    db.session.flush()

    employee_id_code = (data.get("employee_id_code") or "").strip() or generate_employee_id_code()

    employee = Employee(
        full_name=full_name,
        email=company_email,
        personal_email=personal_email,
        phone=phone,
        user_id=user.id,
        department_id=data.get("department_id") or "",
        department_name=data.get("department_name") or "",
        position=data.get("position") or "",
        role=role,
        manager_id=data.get("manager_id") or "",
        status=data.get("status") or "active",
        hire_date=hire_date,
        employee_id_code=employee_id_code,
        invited=True,
    )
    db.session.add(employee)
    db.session.commit()

    # Dispatch credentials to the user's personal email (or company email if personal not given)
    recipient = personal_email or company_email
    message = (
        f"Hi {full_name},\n\n"
        f"Welcome to the EPIC TASK PERFORMANCE TRACKING SYSTEM! An official account has been created for you.\n\n"
        f"Your Login Details:\n"
        f"• Official Company Email: {company_email}\n"
        f"• Temporary Password: {temp_password}\n"
        f"• Employee ID: {employee.employee_id_code}\n\n"
        f"Please log in and update your password upon first sign-in."
    )
    email_sent = (
        send_email(
            to=recipient,
            subject="Your EPIC TASK PERFORMANCE TRACKING SYSTEM account has been created",
            body=message,
            category="onboarding",
        )
        if recipient
        else False
    )
    sms_sent = send_sms(to=phone, message=f"Hi {full_name}, your EPIC account is ready. Login: {company_email}, Temp Password: {temp_password}, ID: {employee.employee_id_code}") if phone else False

    return jsonify({
        "employee": employee.to_dict(),
        "user": user.to_public_dict(),
        "notified": {"email": email_sent, "sms": sms_sent, "recipient": recipient},
    }), 201
