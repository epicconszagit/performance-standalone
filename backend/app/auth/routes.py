import secrets
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models import Employee, User
from ..utils.email import send_email
from ..utils.sms import normalize_phone_number
from ..utils.validation import validate_password, validate_registration_email

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    phone = normalize_phone_number((data.get("phone") or "").strip())
    requested_department = (data.get("requested_department") or "").strip()
    requested_position = (data.get("requested_position") or "").strip()

    if not email or not password or not full_name:
        return jsonify({"error": "full name, email, and password are required"}), 400

    email_ok, email_error = validate_registration_email(email)
    if not email_ok:
        return jsonify({"error": email_error}), 400

    password_ok, password_error = validate_password(password)
    if not password_ok:
        return jsonify({"error": password_error}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "an account with this email already exists"}), 409

    # The very first account on a fresh install becomes an active admin
    # automatically - otherwise nobody would exist to approve anyone.
    # Every account after that starts pending until an admin approves it.
    is_first_user = User.query.count() == 0
    user = User(
        email=email,
        personal_email=email,
        password_hash=generate_password_hash(password),
        full_name=full_name,
        phone=phone,
        requested_department=requested_department,
        requested_position=requested_position,
        role="admin" if is_first_user else "user",
        status="active" if is_first_user else "pending",
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=user.id)
    return jsonify({"access_token": token, "user": user.to_public_dict()}), 201


@auth_bp.route("/check-email", methods=["GET", "POST"])
def check_email():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
    else:
        email = (request.args.get("email") or "").strip().lower()

    if not email or "@" not in email:
        return jsonify({"valid": False, "error": "Incomplete email address."}), 200

    email_ok, email_err = validate_registration_email(email)
    if not email_ok:
        return jsonify({"valid": False, "error": email_err}), 200

    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"valid": False, "error": "An account with this email is already registered."}), 200

    return jsonify({"valid": True, "message": "Valid email address."}), 200


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "invalid email or password"}), 401

    if user.status in ("inactive", "suspended", "terminated", "deleted"):
        return jsonify({"error": "This account has been deactivated or removed by an administrator."}), 403

    # For non-admin accounts that are not pending, verify an active Employee profile exists
    if user.role != "admin" and user.status != "pending":
        emp = Employee.query.filter((Employee.user_id == user.id) | (Employee.email == user.email)).first()
        if not emp or emp.status != "active":
            return jsonify({"error": "Your staff account has been removed by an administrator."}), 403

    token = create_access_token(identity=user.id)
    return jsonify({"access_token": token, "user": user.to_public_dict()})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = User.query.get(get_jwt_identity())
    if not user or user.status in ("inactive", "suspended", "terminated", "deleted"):
        return jsonify({"error": "Account deactivated or not found"}), 401

    if user.role != "admin" and user.status != "pending":
        emp = Employee.query.filter((Employee.user_id == user.id) | (Employee.email == user.email)).first()
        if not emp or emp.status != "active":
            return jsonify({"error": "Staff profile removed"}), 401

    return jsonify(user.to_public_dict())


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    # Stateless JWT: the frontend just drops the token. Nothing to invalidate server-side.
    return jsonify({"ok": True})


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    user = User.query.filter_by(email=email).first()
    if user:
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        db.session.commit()
        send_email(
            to=email,
            subject="Reset your password — EPIC TASK PERFORMANCE TRACKING SYSTEM",
            body=f"Hello,\n\nYou requested to reset your password for the EPIC TASK PERFORMANCE TRACKING SYSTEM. Use this link to set a new password:\n/reset-password?token={token}\n\nIf you did not request this, please ignore this email.",
        )

    # Always the same generic response, regardless of whether the email exists,
    # to avoid leaking which addresses are registered.
    return jsonify({"message": "If that email exists, a reset link has been sent."})


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("resetToken") or data.get("token")
    new_password = data.get("newPassword") or data.get("new_password")

    if not token or not new_password:
        return jsonify({"error": "token and newPassword are required"}), 400

    user = User.query.filter_by(reset_token=token).first()
    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        return jsonify({"error": "invalid or expired reset token"}), 400

    user.password_hash = generate_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.session.commit()
    return jsonify({"message": "Password reset successful"})


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User account not found"}), 404

    data = request.get_json(silent=True) or {}
    old_password = (data.get("old_password") or data.get("current_password") or "").strip()
    new_password = (data.get("new_password") or "").strip()
    confirm_password = (data.get("confirm_password") or "").strip()

    if not old_password:
        return jsonify({"error": "Current password is required"}), 400
    if not new_password:
        return jsonify({"error": "New password is required"}), 400

    if not check_password_hash(user.password_hash, old_password):
        return jsonify({"error": "Incorrect current password"}), 400

    if old_password == new_password:
        return jsonify({"error": "New password cannot be the same as current password"}), 400

    if confirm_password and new_password != confirm_password:
        return jsonify({"error": "New password and confirmation do not match"}), 400

    password_ok, password_error = validate_password(new_password)
    if not password_ok:
        return jsonify({"error": password_error}), 400

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"message": "Password changed successfully"}), 200

