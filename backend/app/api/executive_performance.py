import json
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Department, Employee, Task, AuditLog
from ..utils.performance import calculate_weighted_performance, is_task_overdue
from .generic import current_user

executive_performance_bp = Blueprint("executive_performance", __name__)


def _is_executive_authorized(user):
    """Restricts access strictly to Super Administrator and Chief Executive Officer."""
    if not user:
        return False

    # 1. System super admin role
    if getattr(user, "role", "") == "admin":
        return True

    # 2. Designated administrative email
    email = (getattr(user, "email", "") or "").lower()
    if email == "epiccons.za@gmail.com":
        return True

    # 3. Employee record role & executive position checks
    try:
        emp = Employee.query.filter(
            (Employee.user_id == user.id) | (Employee.email == user.email)
        ).first()
        if not emp or emp.status != "active":
            return False

        emp_role = (getattr(emp, "role", "") or "").strip()
        if emp_role in ("Super Administrator", "Chief Executive Officer"):
            return True

        emp_pos = (getattr(emp, "position", "") or "").strip().lower()
        if any(term in emp_pos for term in ("chief executive officer", "ceo", "chief executive", "managing director")):
            return True
    except Exception:
        pass

    return False


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


@executive_performance_bp.route("/executive/department-performance", methods=["GET"])
@jwt_required()
def get_executive_department_performance():
    user = current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if not _is_executive_authorized(user):
        return jsonify({
            "error": "Access Denied: This strategic performance and budget section is restricted exclusively to the Super Administrator and Chief Executive Officer."
        }), 403

    # Query all active/valid records
    all_departments = Department.query.filter(
        (Department.status == "active") | (Department.status.is_(None))
    ).order_by(Department.name.asc()).all()

    all_tasks = Task.query.filter(
        (Task.deleted == False) | (Task.deleted.is_(None))
    ).all()

    all_employees = Employee.query.filter(
        Employee.status == "active"
    ).all()

    # Pre-parse employee department memberships
    emp_dept_map = {}
    for emp in all_employees:
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

    department_metrics = []

    for dept in all_departments:
        dept_emps = [
            e for e in all_employees
            if dept.id in emp_dept_map.get(e.id, set()) or (dept.manager_id and dept.manager_id == e.id)
        ]
        dept_emp_id_set = {e.id for e in dept_emps}

        dept_tasks = [
            t for t in all_tasks
            if t.department_id == dept.id or any(aid in dept_emp_id_set for aid in task_assignees.get(t.id, []))
        ]

        # 1. Task Velocity & Output
        task_perf = calculate_weighted_performance(dept_tasks)
        total_tasks_count = len(dept_tasks)
        completed_tasks_count = task_perf.get("completed", 0)
        on_time_tasks_count = task_perf.get("on_time", 0)
        late_tasks_count = task_perf.get("late", 0)
        pending_tasks_count = task_perf.get("pending", 0)
        overdue_tasks_count = task_perf.get("overdue", 0)
        task_score = task_perf.get("score", 0)
        on_time_rate = task_perf.get("on_time_rate", 0)
        productivity_rate = task_perf.get("productivity", 0)

        # 2. Financial Budget Calculations
        allocated_budget = float(getattr(dept, "allocated_budget", 0.0) or 0.0)
        actual_spend = float(getattr(dept, "actual_spend", 0.0) or 0.0)
        budget_currency = getattr(dept, "budget_currency", "USD") or "USD"
        fiscal_year = getattr(dept, "fiscal_year", "2026") or "2026"
        budget_variance = round(allocated_budget - actual_spend, 2)

        if allocated_budget > 0:
            utilization_rate = round((actual_spend / allocated_budget) * 100, 1)
        else:
            utilization_rate = 0.0

        if allocated_budget <= 0:
            budget_status = "No Budget Configured"
            budget_health_score = 70.0
        elif actual_spend > allocated_budget:
            budget_status = "Budget Overrun"
            overrun_pct = ((actual_spend - allocated_budget) / allocated_budget) * 100
            budget_health_score = max(15.0, round(85.0 - (overrun_pct * 1.2), 1))
        elif utilization_rate >= 90:
            budget_status = "Near Capacity"
            budget_health_score = 88.0
        elif utilization_rate >= 60:
            budget_status = "Optimal"
            budget_health_score = 100.0
        else:
            budget_status = "Under Budget"
            # Low spend with high output is rewarded; low spend with zero output is tempered
            budget_health_score = round(max(50.0, 65.0 + (utilization_rate * 0.35)), 1)

        cost_per_completed_task = round(actual_spend / completed_tasks_count, 2) if completed_tasks_count > 0 else 0.0

        # 3. Organizational Contribution Calculations
        contribution_type = getattr(dept, "contribution_type", "Operational Support") or "Operational Support"
        revenue_generated = float(getattr(dept, "revenue_generated", 0.0) or 0.0)
        strategic_weight = int(getattr(dept, "strategic_weight", 3) or 3)
        target_score = float(getattr(dept, "target_contribution_score", 85.0) or 85.0)

        if contribution_type == "Revenue Generating":
            # Focus on financial ROI and revenue margin
            if actual_spend > 0:
                roi_pct = round(((revenue_generated - actual_spend) / actual_spend) * 100, 1)
            else:
                roi_pct = 100.0 if revenue_generated > 0 else 0.0
            margin = round(revenue_generated - actual_spend, 2)
            # Contribution score balances margin, ROI, and task velocity
            base_revenue_score = min(100.0, max(20.0, 50.0 + (roi_pct * 0.5)))
            contribution_score = round(base_revenue_score, 1)
        elif contribution_type == "Strategic Enabler":
            roi_pct = None
            margin = None
            # Multiplier applied to task delivery standards
            weight_factor = strategic_weight / 3.0
            contribution_score = min(100.0, round(task_score * weight_factor, 1))
        else:
            # Operational Support: Delivery speed, on-time SLA, cost efficiency
            roi_pct = None
            margin = None
            sla_delivery = (on_time_rate * 0.6) + (productivity_rate * 0.4)
            contribution_score = round(sla_delivery, 1)

        # 4. Composite Departmental Performance & Contribution Index (DPCI: 0 to 100)
        raw_dpci = (task_score * 0.50) + (budget_health_score * 0.25) + (contribution_score * 0.25)
        dpci = max(0, min(100, round(raw_dpci)))

        if dpci >= 85:
            tier = "Tier 1: High Impact"
            tier_color = "emerald"
        elif dpci >= 70:
            tier = "Tier 2: Solid Value"
            tier_color = "blue"
        elif dpci >= 55:
            tier = "Tier 3: Moderate"
            tier_color = "amber"
        else:
            tier = "Tier 4: Underperforming"
            tier_color = "rose"

        department_metrics.append({
            "dept": dept.to_dict(),
            "emp_count": len(dept_emps),
            "tasks_count": total_tasks_count,
            "completed_tasks": completed_tasks_count,
            "on_time_tasks": on_time_tasks_count,
            "late_tasks": late_tasks_count,
            "pending_tasks": pending_tasks_count,
            "overdue_tasks": overdue_tasks_count,
            "task_performance_score": task_score,
            "on_time_rate": on_time_rate,
            "productivity_rate": productivity_rate,
            "allocated_budget": allocated_budget,
            "actual_spend": actual_spend,
            "budget_variance": budget_variance,
            "utilization_rate": utilization_rate,
            "budget_currency": budget_currency,
            "fiscal_year": fiscal_year,
            "budget_status": budget_status,
            "budget_health_score": budget_health_score,
            "cost_per_completed_task": cost_per_completed_task,
            "contribution_type": contribution_type,
            "revenue_generated": revenue_generated,
            "strategic_weight": strategic_weight,
            "target_score": target_score,
            "roi_pct": roi_pct,
            "margin": margin,
            "contribution_score": contribution_score,
            "dpci": dpci,
            "tier": tier,
            "tier_color": tier_color,
        })

    # Sort descending by composite DPCI score
    department_metrics.sort(key=lambda x: x["dpci"], reverse=True)

    # 5. Executive Corporate Summary
    total_allocated = sum(m["allocated_budget"] for m in department_metrics)
    total_spent = sum(m["actual_spend"] for m in department_metrics)
    total_variance = round(total_allocated - total_spent, 2)
    overall_utilization = round((total_spent / total_allocated * 100), 1) if total_allocated > 0 else 0.0
    total_revenue = sum(m["revenue_generated"] for m in department_metrics)

    total_tasks_assigned = sum(m["tasks_count"] for m in department_metrics)
    total_tasks_completed = sum(m["completed_tasks"] for m in department_metrics)
    total_on_time = sum(m["on_time_tasks"] for m in department_metrics)

    overall_completion_rate = round((total_tasks_completed / total_tasks_assigned * 100), 1) if total_tasks_assigned > 0 else 0.0
    overall_on_time_rate = round((total_on_time / total_tasks_completed * 100), 1) if total_tasks_completed > 0 else 0.0
    avg_dpci = round(sum(m["dpci"] for m in department_metrics) / len(department_metrics)) if department_metrics else 0

    top_contributor = department_metrics[0] if department_metrics else None

    # Identify department with highest fiscal overrun or risk
    fiscal_risk_dept = None
    overrun_depts = [m for m in department_metrics if m["allocated_budget"] > 0 and m["actual_spend"] > m["allocated_budget"]]
    if overrun_depts:
        overrun_depts.sort(key=lambda x: (x["actual_spend"] - x["allocated_budget"]), reverse=True)
        fiscal_risk_dept = overrun_depts[0]
    else:
        high_util = [m for m in department_metrics if m["allocated_budget"] > 0]
        if high_util:
            high_util.sort(key=lambda x: x["utilization_rate"], reverse=True)
            fiscal_risk_dept = high_util[0]

    return jsonify({
        "summary": {
            "total_allocated_budget": total_allocated,
            "total_actual_spend": total_spent,
            "total_variance": total_variance,
            "overall_utilization": overall_utilization,
            "total_revenue_generated": total_revenue,
            "total_tasks_assigned": total_tasks_assigned,
            "total_tasks_completed": total_tasks_completed,
            "overall_completion_rate": overall_completion_rate,
            "overall_on_time_rate": overall_on_time_rate,
            "avg_dpci": avg_dpci,
            "department_count": len(department_metrics),
            "top_contributor": top_contributor,
            "fiscal_risk_dept": fiscal_risk_dept,
        },
        "departments": department_metrics,
    })


@executive_performance_bp.route("/executive/departments/<dept_id>/budget", methods=["PATCH"])
@jwt_required()
def update_department_budget_and_contribution(dept_id):
    user = current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if not _is_executive_authorized(user):
        return jsonify({
            "error": "Access Denied: Only Super Administrator and Chief Executive Officer can modify departmental budgets and strategic contribution metrics."
        }), 403

    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"error": "Department not found"}), 404

    data = request.get_json(silent=True) or {}

    old_budget = getattr(dept, "allocated_budget", 0.0)
    old_spend = getattr(dept, "actual_spend", 0.0)

    if "allocated_budget" in data:
        try:
            dept.allocated_budget = max(0.0, float(data.get("allocated_budget") or 0.0))
        except (ValueError, TypeError):
            pass

    if "actual_spend" in data:
        try:
            dept.actual_spend = max(0.0, float(data.get("actual_spend") or 0.0))
        except (ValueError, TypeError):
            pass

    if "budget_currency" in data:
        dept.budget_currency = (data.get("budget_currency") or "USD").strip().upper()

    if "fiscal_year" in data:
        dept.fiscal_year = (data.get("fiscal_year") or "2026").strip()

    if "contribution_type" in data:
        valid_types = ("Operational Support", "Revenue Generating", "Strategic Enabler")
        c_type = data.get("contribution_type")
        if c_type in valid_types:
            dept.contribution_type = c_type

    if "revenue_generated" in data:
        try:
            dept.revenue_generated = max(0.0, float(data.get("revenue_generated") or 0.0))
        except (ValueError, TypeError):
            pass

    if "strategic_weight" in data:
        try:
            dept.strategic_weight = max(1, min(5, int(data.get("strategic_weight") or 3)))
        except (ValueError, TypeError):
            pass

    if "target_contribution_score" in data:
        try:
            dept.target_contribution_score = max(0.0, min(100.0, float(data.get("target_contribution_score") or 85.0)))
        except (ValueError, TypeError):
            pass

    db.session.commit()

    # Log to audit log
    try:
        performer_name = user.full_name or user.email
        audit = AuditLog(
            action="Updated Department Financials",
            entity_type="Department",
            entity_id=dept.id,
            entity_name=dept.name,
            performed_by_id=user.id,
            performed_by_name=performer_name,
            details=f"Budget: {old_budget} -> {dept.allocated_budget}, Spend: {old_spend} -> {dept.actual_spend}, Contribution Type: {dept.contribution_type}",
        )
        db.session.add(audit)
        db.session.commit()
    except Exception:
        pass

    return jsonify({
        "message": "Department budget and contribution parameters updated successfully.",
        "department": dept.to_dict()
    }), 200
