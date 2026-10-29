import json
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Department, Employee, Task, AuditLog, DepartmentFinancialRecord, CompanyBudget
from ..utils.performance import calculate_weighted_performance, is_task_overdue
from .generic import current_user

executive_performance_bp = Blueprint("executive_performance", __name__)


def _ensure_company_budget_table():
    try:
        CompanyBudget.__table__.create(db.engine, checkfirst=True)
    except Exception:
        pass


def _is_executive_authorized(user):
    """Restricts access strictly to Super Administrator and Chief Executive Officer."""
    if not user:
        return False

    # 1. System super admin role
    if getattr(user, "role", "") == "admin":
        return True

    # 2. Designated administrative / executive emails
    email = (getattr(user, "email", "") or "").lower().strip()
    if email in ("epiccons.za@gmail.com", "cmutovhe@epicnetworkgroup.com", "ceo.test@epicnetworkgroup.com"):
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


def _get_active_company_budget():
    _ensure_company_budget_table()
    try:
        return CompanyBudget.query.order_by(CompanyBudget.updated_date.desc()).first()
    except Exception:
        return None


@executive_performance_bp.route("/executive/department-performance", methods=["GET"])
@jwt_required()
def get_executive_department_performance():
    user = current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    if not _is_executive_authorized(user):
        return jsonify({
            "error": "Access Denied: This strategic department revenue and budget tracker is restricted exclusively to the Super Administrator and Chief Executive Officer."
        }), 403

    company_budget_rec = _get_active_company_budget()
    overall_company_budget = float(company_budget_rec.total_budget or 0.0) if company_budget_rec else 0.0
    master_currency = (company_budget_rec.currency if company_budget_rec and company_budget_rec.currency else "USD")
    master_fiscal_year = (company_budget_rec.fiscal_year if company_budget_rec and company_budget_rec.fiscal_year else "2026")

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

        # Breakdown of expenses by category for this department
        expense_categories_map = {}
        for r in dept_records:
            if r.record_type == "expense":
                cat = r.category or "General"
                expense_categories_map[cat] = round(expense_categories_map.get(cat, 0.0) + float(r.amount or 0.0), 2)
        expenses_by_category = [
            {"category": k, "amount": v}
            for k, v in sorted(expense_categories_map.items(), key=lambda item: item[1], reverse=True)
        ]

        # Fallback to direct fields if no ledger entries exist yet
        total_revenue = round(logged_revenue if logged_revenue > 0 else float(getattr(dept, "revenue_generated", 0.0) or 0.0), 2)
        total_expenses = round(logged_expenses if logged_expenses > 0 else float(getattr(dept, "actual_spend", 0.0) or 0.0), 2)

        # Departmental Budget extracted from Overall Company Budget
        allocated_budget = round(float(getattr(dept, "allocated_budget", 0.0) or 0.0), 2)
        # Departmental Revenue Target
        annual_target = round(float(getattr(dept, "annual_budget_target", 0.0) or 0.0), 2)

        budget_currency = getattr(dept, "budget_currency", master_currency) or master_currency
        fiscal_year = getattr(dept, "fiscal_year", master_fiscal_year) or master_fiscal_year

        # Budget Spending / Utilization Calculations (Expenses vs Extracted Dept Budget)
        remaining_budget = round(allocated_budget - total_expenses, 2)
        if allocated_budget > 0:
            budget_utilization_pct = round((total_expenses / allocated_budget) * 100, 1)
        else:
            budget_utilization_pct = 0.0

        if overall_company_budget > 0:
            share_of_company_budget_pct = round((allocated_budget / overall_company_budget) * 100, 1)
        else:
            share_of_company_budget_pct = 0.0

        if allocated_budget <= 0 and total_expenses > 0:
            spending_status = "Unbudgeted Spend"
        elif allocated_budget <= 0:
            spending_status = "No Budget Extracted"
        elif total_expenses > allocated_budget:
            spending_status = "Over Budget"
        elif budget_utilization_pct >= 85:
            spending_status = "Near Limit"
        else:
            spending_status = "Within Budget"

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

        # Effort Yield: Revenue brought in & Cost per completed task
        if completed_tasks_count > 0:
            revenue_per_task = round(total_revenue / completed_tasks_count, 2)
            cost_per_task = round(total_expenses / completed_tasks_count, 2)
        else:
            revenue_per_task = 0.0
            cost_per_task = 0.0

        # Revenue Target Status Tag
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
        budget_discipline_score = (
            100.0 if (allocated_budget > 0 and total_expenses <= allocated_budget)
            else max(0.0, 100.0 - ((total_expenses - allocated_budget) / (allocated_budget or 10000.0) * 100.0))
            if allocated_budget > 0 else 75.0
        )
        target_score = min(100.0, target_progress_pct) if annual_target > 0 else budget_discipline_score
        profit_score = 100.0 if net_contribution >= 0 else max(0.0, 100.0 - (abs(net_contribution) / (allocated_budget or annual_target or 10000.0) * 100.0))
        exec_score = task_score

        dpci = round((0.35 * budget_discipline_score) + (0.35 * target_score) + (0.30 * exec_score), 1)

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
            # Extracted Budget & Spending Metrics
            "allocated_budget": allocated_budget,
            "share_of_company_budget_pct": share_of_company_budget_pct,
            "total_expenses": total_expenses,
            "actual_spend": total_expenses,
            "remaining_budget": remaining_budget,
            "budget_utilization_pct": budget_utilization_pct,
            "spending_status": spending_status,
            "expenses_by_category": expenses_by_category,
            # Revenue Target & Inflow Metrics
            "annual_budget_target": annual_target,
            "total_revenue": total_revenue,
            "net_contribution": net_contribution,
            "target_progress_pct": target_progress_pct,
            "profit_margin_pct": profit_margin_pct,
            "expense_ratio": expense_ratio,
            "budget_currency": budget_currency,
            "fiscal_year": fiscal_year,
            "target_status": target_status,
            "budget_status": spending_status,
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
                for r in dept_records[:25]
            ],
            "total_transactions_count": len(dept_records),
        })

    # Rank departments by Allocated Budget, Revenue, and Profit
    sorted_by_budget = sorted(department_metrics, key=lambda x: x["allocated_budget"], reverse=True)
    for rank, item in enumerate(sorted_by_budget, start=1):
        item["rank_budget"] = rank

    sorted_by_revenue = sorted(department_metrics, key=lambda x: x["total_revenue"], reverse=True)
    for rank, item in enumerate(sorted_by_revenue, start=1):
        item["rank_revenue"] = rank

    sorted_by_profit = sorted(department_metrics, key=lambda x: x["net_contribution"], reverse=True)
    for rank, item in enumerate(sorted_by_profit, start=1):
        item["rank_profit"] = rank

    sorted_by_spending = sorted(department_metrics, key=lambda x: x["total_expenses"], reverse=True)
    for rank, item in enumerate(sorted_by_spending, start=1):
        item["rank_spending"] = rank

    # Default sort: by allocated budget (or revenue if budgets are equal)
    department_metrics = sorted(
        department_metrics,
        key=lambda x: (x["allocated_budget"], x["total_revenue"], x["total_expenses"]),
        reverse=True,
    )

    # Corporate-Wide Budget & Financial Summary
    total_allocated_all = round(sum(d["allocated_budget"] for d in department_metrics), 2)
    total_rev_all = round(sum(d["total_revenue"] for d in department_metrics), 2)
    total_exp_all = round(sum(d["total_expenses"] for d in department_metrics), 2)
    total_net_all = round(total_rev_all - total_exp_all, 2)
    total_target_all = round(sum(d["annual_budget_target"] for d in department_metrics), 2)

    # If no overall company budget record is explicitly saved yet, default to sum of allocated department budgets
    if overall_company_budget <= 0 and total_allocated_all > 0:
        overall_company_budget = total_allocated_all
        for d in department_metrics:
            d["share_of_company_budget_pct"] = round(
                (d["allocated_budget"] / overall_company_budget) * 100, 1
            )

    # Unallocated reserve from overall company budget
    unallocated_budget = round(overall_company_budget - total_allocated_all, 2)
    allocation_pct = round((total_allocated_all / overall_company_budget) * 100, 1) if overall_company_budget > 0 else 0.0

    # Remaining spendable budgets
    remaining_overall_budget = round(overall_company_budget - total_exp_all, 2)
    remaining_allocated_budget = round(total_allocated_all - total_exp_all, 2)

    overall_burn_pct = round((total_exp_all / overall_company_budget) * 100, 1) if overall_company_budget > 0 else 0.0
    allocated_burn_pct = round((total_exp_all / total_allocated_all) * 100, 1) if total_allocated_all > 0 else 0.0

    over_budget_depts_count = sum(
        1 for d in department_metrics if d["allocated_budget"] > 0 and d["total_expenses"] > d["allocated_budget"]
    )

    overall_progress = round((total_rev_all / total_target_all * 100), 1) if total_target_all > 0 else 0.0
    overall_profit_margin = round((total_net_all / total_rev_all * 100), 1) if total_rev_all > 0 else 0.0

    total_tasks_completed_all = sum(d["completed_tasks"] for d in department_metrics)
    avg_rev_per_task = round(total_rev_all / total_tasks_completed_all, 2) if total_tasks_completed_all > 0 else 0.0

    top_earner = sorted_by_revenue[0] if sorted_by_revenue and sorted_by_revenue[0]["total_revenue"] > 0 else None
    top_profit = sorted_by_profit[0] if sorted_by_profit and sorted_by_profit[0]["net_contribution"] > 0 else None
    highest_spender = sorted_by_spending[0] if sorted_by_spending and sorted_by_spending[0]["total_expenses"] > 0 else None

    company_budget_dict = {
        "id": company_budget_rec.id if company_budget_rec else None,
        "is_configured": bool(company_budget_rec and company_budget_rec.total_budget > 0),
        "fiscal_year": master_fiscal_year,
        "title": company_budget_rec.title if company_budget_rec and company_budget_rec.title else f"FY {master_fiscal_year} Master Corporate Budget",
        "total_budget": overall_company_budget,
        "currency": master_currency,
        "notes": (company_budget_rec.notes or "") if company_budget_rec else "",
        "budget_file_url": (company_budget_rec.budget_file_url or "") if company_budget_rec else "",
        "budget_file_name": (company_budget_rec.budget_file_name or "") if company_budget_rec else "",
        "updated_by_name": (company_budget_rec.updated_by_name or "") if company_budget_rec else "",
        "updated_date": company_budget_rec.updated_date.isoformat() if (company_budget_rec and company_budget_rec.updated_date) else None,
    }

    return jsonify({
        "company_budget": company_budget_dict,
        "summary": {
            # Master Budget & Extraction Totals
            "overall_company_budget": overall_company_budget,
            "total_allocated_budget": total_allocated_all,
            "unallocated_budget": unallocated_budget,
            "allocation_pct": allocation_pct,
            "remaining_overall_budget": remaining_overall_budget,
            "remaining_allocated_budget": remaining_allocated_budget,
            "overall_burn_pct": overall_burn_pct,
            "allocated_burn_pct": allocated_burn_pct,
            "over_budget_depts_count": over_budget_depts_count,
            # Revenue, Expense & Net Totals
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
            "highest_spending_dept": highest_spender,
        },
        "departments": department_metrics,
    })


@executive_performance_bp.route("/executive/company-budget", methods=["GET", "POST", "PUT", "PATCH"])
@jwt_required()
def manage_company_budget():
    user = current_user()
    if not user or not _is_executive_authorized(user):
        return jsonify({"error": "Unauthorized"}), 403

    _ensure_company_budget_table()
    rec = _get_active_company_budget()

    if request.method == "GET":
        if not rec:
            return jsonify({
                "company_budget": {
                    "id": None,
                    "is_configured": False,
                    "fiscal_year": "2026",
                    "title": "FY 2026 Master Corporate Budget",
                    "total_budget": 0.0,
                    "currency": "USD",
                    "notes": "",
                    "budget_file_url": "",
                    "budget_file_name": "",
                }
            })
        return jsonify({"company_budget": rec.to_dict()})

    data = request.get_json(silent=True) or {}
    try:
        total_budget = max(0.0, float(data.get("total_budget") or 0.0))
    except (ValueError, TypeError):
        return jsonify({"error": "Please provide a valid numeric overall budget amount."}), 400

    fiscal_year = (data.get("fiscal_year") or "2026").strip()
    title = (data.get("title") or f"FY {fiscal_year} Master Corporate Budget").strip()
    currency = (data.get("currency") or "USD").strip()
    notes = (data.get("notes") or "").strip()
    budget_file_url = data.get("budget_file_url")
    budget_file_name = data.get("budget_file_name")

    performer_name = getattr(user, "full_name", "") or getattr(user, "email", "CEO / Executive")

    if not rec:
        rec = CompanyBudget(
            fiscal_year=fiscal_year,
            title=title,
            total_budget=total_budget,
            currency=currency,
            notes=notes,
            budget_file_url=budget_file_url or "",
            budget_file_name=budget_file_name or "",
            updated_by_id=user.id,
            updated_by_name=performer_name,
        )
        db.session.add(rec)
    else:
        rec.fiscal_year = fiscal_year
        rec.title = title
        rec.total_budget = total_budget
        rec.currency = currency
        rec.notes = notes
        if budget_file_url is not None:
            rec.budget_file_url = budget_file_url
        if budget_file_name is not None:
            rec.budget_file_name = budget_file_name
        rec.updated_by_id = user.id
        rec.updated_by_name = performer_name

    # Optionally apply departmental budget extractions if provided in the same payload
    allocations = data.get("allocations")
    extracted_count = 0
    if isinstance(allocations, list):
        for item in allocations:
            dept_id = item.get("department_id")
            dept_name = (item.get("department_name") or "").strip()
            dept = None
            if dept_id:
                dept = Department.query.get(dept_id)
            elif dept_name:
                dept = Department.query.filter(db.func.lower(Department.name) == dept_name.lower()).first()
            if dept:
                if "allocated_budget" in item and item["allocated_budget"] is not None:
                    try:
                        dept.allocated_budget = max(0.0, round(float(item["allocated_budget"]), 2))
                        extracted_count += 1
                    except (ValueError, TypeError):
                        pass
                if "annual_budget_target" in item and item["annual_budget_target"] is not None:
                    try:
                        dept.annual_budget_target = max(0.0, round(float(item["annual_budget_target"]), 2))
                    except (ValueError, TypeError):
                        pass
                dept.fiscal_year = fiscal_year
                dept.budget_currency = currency

    db.session.commit()

    try:
        details = f"Set Overall Company Budget ({title}) to ${total_budget:,.2f}"
        if budget_file_name:
            details += f" [Uploaded file: {budget_file_name}]"
        if extracted_count > 0:
            details += f" and extracted budgets for {extracted_count} department(s)"
        audit = AuditLog(
            action="Updated Overall Company Budget",
            entity_type="CompanyBudget",
            entity_id=rec.id,
            entity_name=title,
            performed_by_id=user.id,
            performed_by_name=performer_name,
            details=details,
        )
        db.session.add(audit)
        db.session.commit()
    except Exception:
        pass

    return jsonify({
        "message": f"Overall company budget updated to ${total_budget:,.2f}.",
        "company_budget": rec.to_dict(),
    }), 200


@executive_performance_bp.route("/executive/extract-departmental-budgets", methods=["POST"])
@jwt_required()
def extract_departmental_budgets():
    user = current_user()
    if not user or not _is_executive_authorized(user):
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json(silent=True) or {}
    allocations = data.get("allocations") or []
    if not isinstance(allocations, list) or len(allocations) == 0:
        return jsonify({"error": "Please provide departmental budget allocations to extract."}), 400

    performer_name = getattr(user, "full_name", "") or getattr(user, "email", "CEO / Executive")

    # Optionally update overall company budget if passed alongside extraction
    if "overall_budget" in data and data["overall_budget"] is not None:
        try:
            new_overall = max(0.0, float(data["overall_budget"]))
            rec = _get_active_company_budget()
            if not rec:
                rec = CompanyBudget(
                    fiscal_year="2026",
                    title="FY 2026 Master Corporate Budget",
                    total_budget=new_overall,
                    currency="USD",
                    updated_by_id=user.id,
                    updated_by_name=performer_name,
                )
                db.session.add(rec)
            else:
                rec.total_budget = new_overall
                rec.updated_by_id = user.id
                rec.updated_by_name = performer_name
        except (ValueError, TypeError):
            pass

    updated_depts = []
    total_extracted = 0.0

    for item in allocations:
        dept_id = item.get("department_id")
        dept_name = (item.get("department_name") or "").strip()
        dept = None
        if dept_id:
            dept = Department.query.get(dept_id)
        elif dept_name:
            dept = Department.query.filter(
                (db.func.lower(Department.name) == dept_name.lower()) |
                (db.func.lower(Department.code) == dept_name.lower())
            ).first()

        if not dept:
            continue

        if "allocated_budget" in item and item["allocated_budget"] is not None:
            try:
                amt = max(0.0, round(float(item["allocated_budget"]), 2))
                dept.allocated_budget = amt
                total_extracted += amt
                updated_depts.append(f"{dept.name}: ${amt:,.2f}")
            except (ValueError, TypeError):
                pass

        if "annual_budget_target" in item and item["annual_budget_target"] is not None:
            try:
                dept.annual_budget_target = max(0.0, round(float(item["annual_budget_target"]), 2))
            except (ValueError, TypeError):
                pass

    db.session.commit()

    try:
        audit = AuditLog(
            action="Extracted Departmental Budgets",
            entity_type="CompanyBudget",
            entity_id="bulk-extraction",
            entity_name="Departmental Budget Allocation",
            performed_by_id=user.id,
            performed_by_name=performer_name,
            details=f"Extracted ${total_extracted:,.2f} across {len(updated_depts)} department(s): " + "; ".join(updated_depts[:8]),
        )
        db.session.add(audit)
        db.session.commit()
    except Exception:
        pass

    return jsonify({
        "message": f"Successfully extracted departmental budgets for {len(updated_depts)} department(s).",
        "updated_count": len(updated_depts),
        "total_extracted": round(total_extracted, 2),
    }), 200


@executive_performance_bp.route("/executive/departments/<dept_id>/budget", methods=["PATCH"])
@jwt_required()
def update_department_budget(dept_id):
    user = current_user()
    if not user or not _is_executive_authorized(user):
        return jsonify({"error": "Unauthorized"}), 403

    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"error": "Department not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        if "allocated_budget" in data and data["allocated_budget"] is not None:
            dept.allocated_budget = max(0.0, round(float(data.get("allocated_budget") or 0.0), 2))
        if "annual_budget_target" in data and data["annual_budget_target"] is not None:
            dept.annual_budget_target = max(0.0, round(float(data.get("annual_budget_target") or 0.0), 2))
        db.session.commit()

        performer_name = getattr(user, "full_name", "") or getattr(user, "email", "Executive")
        audit = AuditLog(
            action="Updated Extracted Department Budget",
            entity_type="Department",
            entity_id=dept.id,
            entity_name=dept.name,
            performed_by_id=user.id,
            performed_by_name=performer_name,
            details=f"Extracted budget for {dept.name} set to ${dept.allocated_budget:,.2f} (Revenue target: ${dept.annual_budget_target:,.2f})",
        )
        db.session.add(audit)
        db.session.commit()

        return jsonify({
            "message": f"Extracted budget for {dept.name} updated to ${dept.allocated_budget:,.2f}.",
            "department": dept.to_dict(),
        }), 200
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid budget amount"}), 400


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
        if "annual_budget_target" in data and data["annual_budget_target"] is not None:
            dept.annual_budget_target = max(0.0, round(float(data.get("annual_budget_target") or 0.0), 2))
        if "allocated_budget" in data and data["allocated_budget"] is not None:
            dept.allocated_budget = max(0.0, round(float(data.get("allocated_budget") or 0.0), 2))
        db.session.commit()

        performer_name = getattr(user, "full_name", "") or getattr(user, "email", "Executive")
        audit = AuditLog(
            action="Updated Department Budget & Target",
            entity_type="Department",
            entity_id=dept.id,
            entity_name=dept.name,
            performed_by_id=user.id,
            performed_by_name=performer_name,
            details=f"Extracted Budget: ${dept.allocated_budget:,.2f} | Revenue Target: ${dept.annual_budget_target:,.2f}",
        )
        db.session.add(audit)
        db.session.commit()

        return jsonify({"message": f"Updated budget settings for {dept.name}.", "department": dept.to_dict()}), 200
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid budget or target amount"}), 400
