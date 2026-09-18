import json
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..models import Task, Employee, Department
from ..utils.performance import calculate_weighted_performance
from .generic import current_user

performance_overview_bp = Blueprint("performance_overview", __name__)


def _is_admin_employee(emp):
    if not emp:
        return False
    role = getattr(emp, "role", "") or ""
    email = (getattr(emp, "email", "") or "").lower()
    return role in ("Super Administrator", "Administrator") or email == "epiccons.za@gmail.com"


def _safe_json_list(val):
    if not val:
        return []
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


@performance_overview_bp.route("/performance/overview", methods=["GET"])
@jwt_required()
def get_performance_overview():
    user = current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    # Query all active records
    all_tasks = Task.query.filter(
        (Task.deleted == False) | (Task.deleted.is_(None))
    ).all()
    all_departments = Department.query.filter(
        (Department.status == "active") | (Department.status.is_(None))
    ).all()
    all_employees = Employee.query.filter(
        Employee.status == "active"
    ).all()

    # Filter out administrators from performance evaluations
    active_eval_employees = [e for e in all_employees if not _is_admin_employee(e)]
    eval_emp_ids = {e.id for e in active_eval_employees}

    # Pre-parse employee department memberships
    emp_dept_map = {}
    for emp in active_eval_employees:
        depts = set()
        if emp.department_id:
            depts.add(emp.department_id)
        for d in _safe_json_list(emp.department_ids):
            if d:
                depts.add(d)
        emp_dept_map[emp.id] = depts

    # Pre-parse task assignees
    task_assignees = {}
    for t in all_tasks:
        task_assignees[t.id] = _safe_json_list(t.assigned_to_ids)

    # 1. Company Performance (across all tasks)
    company_perf = calculate_weighted_performance(all_tasks)

    # 2. Department Rankings
    department_rankings = []
    for dept in all_departments:
        dept_emps = [
            e for e in active_eval_employees
            if dept.id in emp_dept_map.get(e.id, set()) or (dept.manager_id and dept.manager_id == e.id)
        ]
        dept_emp_id_set = {e.id for e in dept_emps}

        dept_tasks = [
            t for t in all_tasks
            if t.department_id == dept.id or any(aid in dept_emp_id_set for aid in task_assignees.get(t.id, []))
        ]

        dept_perf = calculate_weighted_performance(dept_tasks)
        department_rankings.append({
            "dept": dept.to_dict(),
            "empCount": len(dept_emps),
            "perf": dept_perf,
        })

    # Sort departments by score descending
    department_rankings.sort(key=lambda x: x["perf"]["score"], reverse=True)

    # 3. Individual Employee Performances
    employee_perfs = {}
    all_perfs = []
    for emp in active_eval_employees:
        emp_tasks = [
            t for t in all_tasks
            if emp.id in task_assignees.get(t.id, [])
        ]
        emp_perf = calculate_weighted_performance(emp_tasks)
        employee_perfs[emp.id] = emp_perf
        all_perfs.append({
            "employee": emp.to_dict(),
            "perf": emp_perf,
        })

    # 4. Top Performers (across evaluated staff)
    top_performers = [
        p for p in all_perfs
        if p["perf"]["assigned"] > 0 or p["perf"]["score"] > 0
    ]
    top_performers.sort(key=lambda x: x["perf"]["score"], reverse=True)
    top_performers = top_performers[:5]

    # 5. Needs Attention / Improvement
    needs_attention = [
        p for p in all_perfs
        if p["perf"]["score"] < 60 and p["perf"]["assigned"] > 0
    ]
    needs_attention.sort(key=lambda x: x["perf"]["score"])

    # Average score across evaluated employees
    avg_score = round(sum(p["perf"]["score"] for p in all_perfs) / len(all_perfs)) if all_perfs else 0

    return jsonify({
        "company_perf": company_perf,
        "department_rankings": department_rankings,
        "employee_perfs": employee_perfs,
        "all_perfs": all_perfs,
        "top_performers": top_performers,
        "needs_attention": needs_attention,
        "avg_score": avg_score,
    })
