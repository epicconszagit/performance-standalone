import json
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Department, Employee, Task, AuditLog, DepartmentFinancialRecord
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
            "error": "Access Denied: This strategic department revenue and target tracker is restricted exclusively to the Super Administrator and Chief Executive Officer."
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

    all_financial_records = DepartmentFinancialRecord.query.order_by(
        DepartmentFinancialRecord.created_date.desc()
    ).all()

    # Map financial records by department
    records_by_dept = {}
    for r in all_financial_records:
        records_by_dept.setdefault(r.department_id, []).append(r)

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
        on_time_rate = task_perf.get("on_time_rate", 0)
        task_score = task_perf.get("score", 0)

        # 2. Financial Calculations from Recorded Transactions & Department Fields
        dept_records = records_by_dept.get(dept.id, [])
        logged_revenue = sum(float(r.amount) for r in dept_records if r.record_type == "revenue")
        logged_expenses = sum(float(r.amount) for r in dept_records if r.record_type == "expense")

        # Fallback to direct fields if no ledger entries exist yet
        total_revenue = logged_revenue if logged_revenue > 0 else float(getattr(dept, "revenue_generated", 0.0) or 0.0)
        total_expenses = logged_expenses if logged_expenses > 0 else float(getattr(dept, "actual_spend", 0.0) or 0.0)

        annual_target = float(getattr(dept, "annual_budget_target", 0.0) or getattr(dept, "allocated_budget", 0.0) or 0.0)
        budget_currency = getattr(dept, "budget_currency", "USD") or "USD"
        fiscal_year = getattr(dept, "fiscal_year", "2026") or "2026"

        net_contribution = round(total_revenue - total_expenses, 2)

        # Target Achievement Rate
        if annual_target > 0:
            target_progress_pct = round((total_revenue / annual_target) * 100, 1)
        else:
            target_progress_pct = 0.0

        # Profit Margin Rate
        if total_revenue > 0:
            profit_margin_pct = round((net_contribution / total_revenue) * 100, 1)
            expense_ratio = round((total_expenses / total_revenue) * 100, 1)
        else:
            profit_margin_pct = 0.0
            expense_ratio = 0.0

        # Effort Yield: Revenue brought in per completed task
        if completed_tasks_count > 0:
            revenue_per_task = round(total_revenue / completed_tasks_count, 2)
            cost_per_task = round(total_expenses / completed_tasks_count, 2)
        else:
            revenue_per_task = 0.0
            cost_per_task = 0.0

        # Status Tag
        if annual_target <= 0:
            target_status = "No Target Configured"
        elif target_progress_pct >= 100:
            target_status = "Target Exceeded"
        elif target_progress_pct >= 75:
            target_status = "On Track"
        elif target_progress_pct >= 40:
            target_status = "In Progress"
        else:
            target_status = "Lagging Target"

        # Comprehensive Contribution Index (DPCI 0-100)
        # 40% Target fulfillment, 30% Net Profit health, 30% Task Execution
        target_score = min(100.0, target_progress_pct)
        profit_score = 100.0 if net_contribution >= 0 else max(0.0, 100.0 - (abs(net_contribution) / (annual_target or 10000.0) * 100.0))
        exec_score = task_score

        dpci = round((0.40 * target_score) + (0.30 * profit_score) + (0.30 * exec_score), 1)

        if dpci >= 85:
            tier = "Tier 1: High Producer"
        elif dpci >= 70:
            tier = "Tier 2: Strong Performer"
        elif dpci >= 50:
            tier = "Tier 3: Moderate"
        else:
            tier = "Tier 4: Needs Acceleration"

        department_metrics.append({
            "dept": {
                "id": dept.id,
                "name": dept.name,
                "code": dept.code or "",
                "color": dept.color or "#1e3a5f",
                "manager_name": dept.manager_name or "Unassigned",
                "manager_id": dept.manager_id,
            },
            # Financial Target & Contribution
            "annual_budget_target": annual_target,
            "allocated_budget": annual_target,  # backwards compatibility
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "actual_spend": total_expenses,     # backwards compatibility
            "net_contribution": net_contribution,
            "target_progress_pct": target_progress_pct,
            "profit_margin_pct": profit_margin_pct,
            "expense_ratio": expense_ratio,
            "budget_currency": budget_currency,
            "fiscal_year": fiscal_year,
            "target_status": target_status,
            "budget_status": target_status,     # backwards compatibility
            # Work Output & Effort
            "tasks_count": total_tasks_count,
            "completed_tasks": completed_tasks_count,
            "on_time_rate": on_time_rate,
            "revenue_per_task": revenue_per_task,
            "cost_per_completed_task": cost_per_task,
            "staff_count": len(dept_emps),
            # Performance Score
            "dpci": dpci,
            "tier": tier,
            "recent_records": [
                {
                    "id": r.id,
                    "record_type": r.record_type,
                    "amount": r.amount,
                    "title": r.title,
                    "category": r.category,
                    "transaction_date": r.transaction_date,
                    "notes": r.notes or "",
                    "recorded_by_name": r.recorded_by_name or "",
                    "created_date": r.created_date.isoformat() if r.created_date else None,
                }
                for r in dept_records[:5]
            ],
            "total_transactions_count": len(dept_records),
        })

    # Rank departments by Total Revenue Brought In
    sorted_by_revenue = sorted(department_metrics, key=lambda x: x["total_revenue"], reverse=True)
    for rank, item in enumerate(sorted_by_revenue, start=1):
        item["rank_revenue"] = rank

    # Rank departments by Net Profit / Contribution
    sorted_by_profit = sorted(department_metrics, key=lambda x: x["net_contribution"], reverse=True)
    for rank, item in enumerate(sorted_by_profit, start=1):
        item["rank_profit"] = rank

    # Sort final metrics list by revenue by default
    department_metrics = sorted_by_revenue

    # Corporate-Wide Summary
    total_rev_all = round(sum(d["total_revenue"] for d in department_metrics), 2)
    total_exp_all = round(sum(d["total_expenses"] for d in department_metrics), 2)
    total_net_all = round(total_rev_all - total_exp_all, 2)
    total_target_all = round(sum(d["annual_budget_target"] for d in department_metrics), 2)

    overall_progress = round((total_rev_all / total_target_all * 100), 1) if total_target_all > 0 else 0.0
    overall_profit_margin = round((total_net_all / total_rev_all * 100), 1) if total_rev_all > 0 else 0.0

    total_tasks_completed_all = sum(d["completed_tasks"] for d in department_metrics)
    avg_rev_per_task = round(total_rev_all / total_tasks_completed_all, 2) if total_tasks_completed_all > 0 else 0.0

    top_earner = department_metrics[0] if department_metrics and department_metrics[0]["total_revenue"] > 0 else None
    top_profit = sorted_by_profit[0] if sorted_by_profit and sorted_by_profit[0]["net_contribution"] > 0 else None

    return jsonify({
        "summary": {
            "total_revenue": total_rev_all,
            "total_expenses": total_exp_all,
            "net_contribution": total_net_all,
            "total_annual_target": total_target_all,
            "overall_target_progress_pct": overall_progress,
            "overall_profit_margin_pct": overall_profit_margin,
            "total_tasks_completed": total_tasks_completed_all,
            "avg_revenue_per_task": avg_rev_per_task,
            "department_count": len(department_metrics),
            "top_earning_dept": top_earner,
            "top_profit_dept": top_profit,
        },
        "departments": department_metrics,
    })


@executive_performance_bp.route("/executive/financial-records", methods=["GET"])
@jwt_required()
def list_financial_records():
    user = current_user()
    if not user or not _is_executive_authorized(user):
        return jsonify({"error": "Unauthorized"}), 403

    dept_id = request.args.get("department_id")
    record_type = request.args.get("record_type")
    limit = min(200, max(1, int(request.args.get("limit", 100))))

    query = DepartmentFinancialRecord.query
    if dept_id:
        query = query.filter_by(department_id=dept_id)
    if record_type in ("revenue", "expense"):
        query = query.filter_by(record_type=record_type)

    records = query.order_by(DepartmentFinancialRecord.created_date.desc()).limit(limit).all()

    # Attach department names
    departments = {d.id: d.name for d in Department.query.all()}

    results = []
    for r in records:
        data = r.to_dict()
        data["department_name"] = departments.get(r.department_id, "Unknown")
        results.append(data)

    return jsonify({"records": results})


@executive_performance_bp.route("/executive/financial-records", methods=["POST"])
@jwt_required()
def create_financial_record():
    user = current_user()
    if not user or not _is_executive_authorized(user):
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json(silent=True) or {}
    dept_id = data.get("department_id")
    record_type = (data.get("record_type") or "").strip().lower()
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "General").strip()
    notes = (data.get("notes") or "").strip()
    transaction_date = (data.get("transaction_date") or datetime.utcnow().strftime("%Y-%m-%d")).strip()

    try:
        amount = float(data.get("amount") or 0.0)
    except (ValueError, TypeError):
        return jsonify({"error": "Valid numeric amount is required"}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be greater than zero"}), 400

    if record_type not in ("revenue", "expense"):
        return jsonify({"error": "Record type must be either 'revenue' or 'expense'"}), 400

    if not title:
        return jsonify({"error": "Description / Title is required"}), 400

    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"error": "Department not found"}), 404

    performer_name = getattr(user, "full_name", "") or getattr(user, "email", "Executive")

    record = DepartmentFinancialRecord(
        department_id=dept.id,
        record_type=record_type,
        amount=amount,
        currency="USD",
        title=title,
        category=category,
        transaction_date=transaction_date,
        notes=notes,
        recorded_by_id=user.id,
        recorded_by_name=performer_name,
    )
    db.session.add(record)

    # Automatically keep aggregate fields in sync on Department
    if record_type == "revenue":
        current_rev = float(getattr(dept, "revenue_generated", 0.0) or 0.0)
        dept.revenue_generated = round(current_rev + amount, 2)
    else:
        current_spend = float(getattr(dept, "actual_spend", 0.0) or 0.0)
        dept.actual_spend = round(current_spend + amount, 2)

    db.session.commit()

    # Log to Audit
    try:
        audit = AuditLog(
            action=f"Logged Department {record_type.capitalize()}",
            entity_type="DepartmentFinancialRecord",
            entity_id=record.id,
            entity_name=dept.name,
            performed_by_id=user.id,
            performed_by_name=performer_name,
            details=f"Added ${amount:,.2f} {record_type} for {dept.name} ({title})",
        )
        db.session.add(audit)
        db.session.commit()
    except Exception:
        pass

    res = record.to_dict()
    res["department_name"] = dept.name
    return jsonify({"message": f"{record_type.capitalize()} entry recorded successfully.", "record": res}), 201


@executive_performance_bp.route("/executive/financial-records/<record_id>", methods=["DELETE"])
@jwt_required()
def delete_financial_record(record_id):
    user = current_user()
    if not user or not _is_executive_authorized(user):
        return jsonify({"error": "Unauthorized"}), 403

    record = DepartmentFinancialRecord.query.get(record_id)
    if not record:
        return jsonify({"error": "Financial record not found"}), 404

    dept = Department.query.get(record.department_id)
    if dept:
        if record.record_type == "revenue":
            current_rev = float(getattr(dept, "revenue_generated", 0.0) or 0.0)
            dept.revenue_generated = max(0.0, round(current_rev - record.amount, 2))
        else:
            current_spend = float(getattr(dept, "actual_spend", 0.0) or 0.0)
            dept.actual_spend = max(0.0, round(current_spend - record.amount, 2))

    performer_name = getattr(user, "full_name", "") or getattr(user, "email", "Executive")
    details = f"Deleted {record.record_type} of ${record.amount:,.2f} ({record.title}) for {dept.name if dept else 'Department'}"

    db.session.delete(record)
    db.session.commit()

    try:
        audit = AuditLog(
            action="Deleted Financial Record",
            entity_type="DepartmentFinancialRecord",
            entity_id=record_id,
            entity_name=dept.name if dept else "Department",
            performed_by_id=user.id,
            performed_by_name=performer_name,
            details=details,
        )
        db.session.add(audit)
        db.session.commit()
    except Exception:
        pass

    return jsonify({"message": "Financial record deleted successfully."}), 200


@executive_performance_bp.route("/executive/departments/<dept_id>/target", methods=["PATCH"])
@jwt_required()
def update_department_target(dept_id):
    user = current_user()
    if not user or not _is_executive_authorized(user):
        return jsonify({"error": "Unauthorized"}), 403

    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"error": "Department not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        new_target = max(0.0, float(data.get("annual_budget_target") or data.get("allocated_budget") or 0.0))
        dept.annual_budget_target = new_target
        dept.allocated_budget = new_target  # keep in sync
        db.session.commit()

        performer_name = getattr(user, "full_name", "") or getattr(user, "email", "Executive")
        audit = AuditLog(
            action="Updated Annual Budget Target",
            entity_type="Department",
            entity_id=dept.id,
            entity_name=dept.name,
            performed_by_id=user.id,
            performed_by_name=performer_name,
            details=f"Annual target set to ${new_target:,.2f}",
        )
        db.session.add(audit)
        db.session.commit()

        return jsonify({"message": f"Annual target for {dept.name} updated to ${new_target:,.2f}.", "department": dept.to_dict()}), 200
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid annual target amount"}), 400
