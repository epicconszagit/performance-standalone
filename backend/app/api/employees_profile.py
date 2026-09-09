from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Employee
from .generic import _coerce_value, current_user

employees_profile_bp = Blueprint("employees_profile", __name__)

# Fields a staff member may edit on their own record. Identity/employment
# fields (name, email, role, department, position, status) stay admin-only
# via the generic /employees endpoint - self-service here can't touch them.
SELF_EDITABLE_FIELDS = {"phone", "date_of_birth", "address", "avatar_url"}


def _find_my_employee(user):
    employee = Employee.query.filter_by(user_id=user.id).first()
    if employee is None and user.email:
        employee = Employee.query.filter_by(email=user.email).first()
    return employee


@employees_profile_bp.route("/employees/me", methods=["GET"])
@jwt_required()
def get_my_profile():
    user = current_user()
    employee = _find_my_employee(user)
    if employee is None:
        return jsonify({"error": "No employee record linked to this account"}), 404
    return jsonify(employee.to_dict())


@employees_profile_bp.route("/employees/me", methods=["PATCH"])
@jwt_required()
def update_my_profile():
    user = current_user()
    employee = _find_my_employee(user)
    if employee is None:
        return jsonify({"error": "No employee record linked to this account"}), 404

    is_admin_record = (
        employee.role in ("Super Administrator", "Administrator")
        or (employee.email and employee.email.lower() == "epiccons.za@gmail.com")
    )
    if is_admin_record and user.role != "admin":
        return jsonify({"error": "Access Denied: Only administrators are authorized to edit an administrator profile."}), 403

    data = request.get_json(silent=True) or {}
    columns = {c.name: c for c in Employee.__table__.columns}
    for key, value in data.items():
        if key in SELF_EDITABLE_FIELDS:
            setattr(employee, key, _coerce_value(columns[key], value))

    db.session.commit()
    return jsonify(employee.to_dict())
