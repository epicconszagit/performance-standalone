import secrets
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models import User
from ..utils.email import send_email
from ..utils.validation import validate_password, validate_registration_email

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    phone = (data.get("phone") or "").strip()
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


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "invalid email or password"}), 401

    token = create_access_token(identity=user.id)
    return jsonify({"access_token": token, "user": user.to_public_dict()})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify({"error": "not found"}), 404
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
            subject="Reset your password",
            body=f"Use this link to reset your password: /reset-password?token={token}",
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
