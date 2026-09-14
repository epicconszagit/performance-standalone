from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Department, Employee
from .generic import current_user

department_members_bp = Blueprint("department_members", __name__)


def can_manage_department(user, dept):
    if not user:
        return False
    if user.role == "admin":
        return True
    emp = Employee.query.filter((Employee.user_id == user.id) | (Employee.email == user.email)).first()
    if emp:
        if emp.role in ("Super Administrator", "Administrator", "Director of Operations"):
            return True
        if emp.role == "Department Manager" and (emp.department_id == dept.id or (emp.department_ids and dept.id in emp.department_ids)):
            return True
        if dept.manager_id == emp.id:
            return True
    return False


@department_members_bp.route("/departments/<dept_id>/members", methods=["GET"])
@jwt_required()
def get_department_members(dept_id):
    dept = Department.query.get_or_404(dept_id)
    all_employees = Employee.query.filter(Employee.status == "active").all()
    members = []
    for emp in all_employees:
        dept_ids = emp.department_ids if isinstance(emp.department_ids, list) else []
        if emp.department_id == dept.id or dept.id in dept_ids or (dept.manager_id and dept.manager_id == emp.id):
            emp_dict = emp.to_dict()
            emp_dict["is_primary_department"] = (emp.department_id == dept.id)
            members.append(emp_dict)
    return jsonify(members)


@department_members_bp.route("/departments/<dept_id>/members", methods=["POST"])
@jwt_required()
def add_department_members(dept_id):
    user = current_user()
    dept = Department.query.get_or_404(dept_id)
    if not can_manage_department(user, dept):
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    emp_ids = list(data.get("employee_ids") or [])
    single_id = data.get("employee_id")
    if single_id and single_id not in emp_ids:
        emp_ids.append(single_id)

    if not emp_ids:
        return jsonify({"error": "No employee specified"}), 400

    is_primary = bool(data.get("is_primary", False))
    updated_employees = []

    for eid in emp_ids:
        emp = Employee.query.get(eid)
        if not emp:
            continue
        current_ids = list(emp.department_ids or [])
        if dept.id not in current_ids:
            current_ids.append(dept.id)
        emp.department_ids = current_ids

        # If designated as primary or if employee has no primary department:
        if is_primary or not emp.department_id:
            emp.department_id = dept.id
            emp.department_name = dept.name

        updated_employees.append(emp)

    db.session.commit()
    return jsonify({
        "success": True,
        "message": f"Successfully assigned {len(updated_employees)} staff member(s) to {dept.name}",
        "employees": [e.to_dict() for e in updated_employees]
    })


@department_members_bp.route("/departments/<dept_id>/members/<emp_id>", methods=["DELETE"])
@jwt_required()
def remove_department_member(dept_id, emp_id):
    user = current_user()
    dept = Department.query.get_or_404(dept_id)
    if not can_manage_department(user, dept):
        return jsonify({"error": "forbidden"}), 403

    emp = Employee.query.get_or_404(emp_id)
    current_ids = list(emp.department_ids or [])
    if dept.id in current_ids:
        current_ids = [did for did in current_ids if did != dept.id]
        emp.department_ids = current_ids

    # If this was their primary department:
    if emp.department_id == dept.id:
        if current_ids:
            # Reassign to first remaining department
            next_dept = Department.query.get(current_ids[0])
            if next_dept:
                emp.department_id = next_dept.id
                emp.department_name = next_dept.name
            else:
                emp.department_id = None
                emp.department_name = ""
        else:
            emp.department_id = None
            emp.department_name = ""

    db.session.commit()
    return jsonify({
        "success": True,
        "message": f"Successfully removed {emp.full_name} from {dept.name}",
        "employee": emp.to_dict()
    })
