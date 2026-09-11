from flask import Blueprint

from ..extensions import db
from .generic import register_entity
from ..models import (
    ActionItem,
    Announcement,
    AuditLog,
    CompanyBranding,
    Department,
    Employee,
    Meeting,
    MeetingMinutes,
    Notification,
    PerformanceReport,
    Report,
    Task,
    TodoItem,
    User,
)


def filter_reports_confidentiality(reports, user):
    if not user or user.role == "admin":
        return reports

    emp = Employee.query.filter_by(user_id=user.id).first()
    emp_id = emp.id if emp else None

    allowed = []
    for r in reports:
        is_confidential = getattr(r, "is_confidential", False)
        to_ids = getattr(r, "submitted_to_ids", None) or []

        # If not confidential and no specific recipients, it's public to all staff
        if not is_confidential and not to_ids:
            allowed.append(r)
            continue

        # If user/employee submitted it, they can view it
        if (emp_id and r.submitted_by_id == emp_id) or r.created_by_id == user.id:
            allowed.append(r)
            continue

        # If employee is an assigned recipient, they can view it
        if emp_id and emp_id in to_ids:
            allowed.append(r)
            continue

    return allowed


def build_entities_blueprint():
    bp = Blueprint("entities", __name__)

    register_entity(bp, ActionItem, "action-items", create="any", update="owner_or_admin", delete="owner_or_admin")
    register_entity(bp, Announcement, "announcements", create="admin", update="admin", delete="admin")
    register_entity(bp, AuditLog, "audit-logs", create="any", update="admin", delete="admin")
    register_entity(bp, CompanyBranding, "company-brandings", create="admin", update="admin", delete="admin")
    register_entity(bp, Department, "departments", create="admin", update="admin", delete="admin")
    def _is_admin_employee(emp):
        if not emp:
            return False
        if emp.role in ("Super Administrator", "Administrator"):
            return True
        if emp.email and emp.email.lower() == "epiccons.za@gmail.com":
            return True
        if emp.user_id:
            u = User.query.get(emp.user_id)
            if u and u.role == "admin":
                return True
        return False

    def before_update_employee(emp, user):
        if _is_admin_employee(emp):
            if not user or user.role != "admin":
                return "Access Denied: Only administrators are authorized to edit an administrator profile."
        return None

    def on_delete_employee(emp, user):
        if _is_admin_employee(emp):
            if not user or user.role != "admin":
                return "Access Denied: Only administrators are authorized to delete an administrator profile."
            active_admin_count = User.query.filter_by(role="admin", status="active").count()
            if active_admin_count <= 1:
                return "Cannot delete the primary administrator account."

        # 2. Find and delete linked user accounts so they cannot log back in
        linked_users = []
        if emp.user_id:
            u = User.query.get(emp.user_id)
            if u and u not in linked_users:
                linked_users.append(u)
        if emp.email:
            u = User.query.filter((User.email == emp.email) | (User.personal_email == emp.email)).first()
            if u and u not in linked_users:
                linked_users.append(u)

        for u in linked_users:
            if u.role == "admin":
                active_admin_count = User.query.filter_by(role="admin", status="active").count()
                if active_admin_count <= 1:
                    continue
            db.session.delete(u)
        return None

    def on_update_employee(emp, user):
        # Sync employee status to linked User account
        linked_users = []
        if emp.user_id:
            u = User.query.get(emp.user_id)
            if u and u not in linked_users:
                linked_users.append(u)
        if emp.email:
            u = User.query.filter((User.email == emp.email) | (User.personal_email == emp.email)).first()
            if u and u not in linked_users:
                linked_users.append(u)

        for u in linked_users:
            if emp.status in ("inactive", "terminated", "suspended"):
                u.status = "inactive"
            elif emp.status == "active":
                u.status = "active"

    def before_create_employee(emp, user, data):
        email = (getattr(emp, "email", None) or "").strip().lower()
        personal_email = (getattr(emp, "personal_email", None) or "").strip().lower()

        if email:
            existing_user = User.query.filter(
                (db.func.lower(User.email) == email) | (db.func.lower(User.personal_email) == email)
            ).first()
            existing_emp = Employee.query.filter(
                (db.func.lower(Employee.email) == email) | (db.func.lower(Employee.personal_email) == email)
            ).first()
            if existing_user or existing_emp:
                return f"An account with this email ('{email}') has already been created."

        if personal_email:
            existing_user = User.query.filter(
                (db.func.lower(User.email) == personal_email) | (db.func.lower(User.personal_email) == personal_email)
            ).first()
            existing_emp = Employee.query.filter(
                (db.func.lower(Employee.email) == personal_email) | (db.func.lower(Employee.personal_email) == personal_email)
            ).first()
            if existing_user or existing_emp:
                return f"An account with this email ('{personal_email}') has already been created."

        return None

    register_entity(
        bp,
        Employee,
        "employees",
        create="admin",
        update="admin",
        delete="admin",
        before_create=before_create_employee,
        before_delete=on_delete_employee,
        before_update=before_update_employee,
        after_update=on_update_employee,
    )
    def validate_meeting_date(meeting, user, data=None):
        from datetime import date as dt_date, datetime
        raw_date = None
        if data and "date" in data:
            raw_date = data.get("date")
        elif hasattr(meeting, "date") and meeting.date:
            raw_date = meeting.date

        if not raw_date:
            return "Meeting date is required."

        target_date = None
        if isinstance(raw_date, str):
            try:
                target_date = datetime.strptime(raw_date.strip().split("T")[0], "%Y-%m-%d").date()
            except Exception:
                return "Invalid date format for meeting. Expected YYYY-MM-DD."
        elif hasattr(raw_date, "date"):
            target_date = raw_date.date()
        elif isinstance(raw_date, dt_date):
            target_date = raw_date

        if target_date and target_date < dt_date.today():
            return f"Cannot schedule or move a meeting to a past date ({target_date}). Meeting dates must start from the current date going forward."

        return None

    register_entity(
        bp,
        Meeting,
        "meetings",
        create="any",
        update="owner_or_admin",
        delete="owner_or_admin",
        before_create=validate_meeting_date,
        before_update=validate_meeting_date,
    )
    register_entity(
        bp, MeetingMinutes, "meeting-minutes", create="any", update="owner_or_admin", delete="owner_or_admin"
    )
    def on_create_notification(notif, sender_user, raw_data):
        try:
            from datetime import datetime
            import logging
            from ..utils.email import send_email

            # 1. Identify Sender
            sender_name = "EPIC System Administrator"
            sender_role = "Administrator"
            if sender_user:
                emp_sender = Employee.query.filter(
                    (Employee.user_id == sender_user.id) | (Employee.email == sender_user.email)
                ).first()
                if emp_sender:
                    sender_name = emp_sender.full_name
                    sender_role = emp_sender.position or emp_sender.role
                else:
                    sender_name = sender_user.full_name or "Administrator"
                    sender_role = (sender_user.role or "Administrator").title()

            # 2. Identify Recipient and Target Email (priority: personal_email)
            recipient_emp = None
            recipient_user = None

            if notif.employee_id:
                recipient_emp = Employee.query.get(notif.employee_id)
            if not recipient_emp and notif.user_id:
                recipient_emp = Employee.query.filter(
                    (Employee.user_id == notif.user_id) | (Employee.id == notif.user_id)
                ).first()

            if notif.user_id:
                recipient_user = User.query.get(notif.user_id)
            if not recipient_user and recipient_emp and recipient_emp.user_id:
                recipient_user = User.query.get(recipient_emp.user_id)

            recipient_name = (
                (recipient_emp and recipient_emp.full_name)
                or (recipient_user and recipient_user.full_name)
                or "Team Member"
            )

            recipient_email = None
            if recipient_emp and recipient_emp.personal_email:
                recipient_email = recipient_emp.personal_email.strip()
            elif recipient_user and recipient_user.personal_email:
                recipient_email = recipient_user.personal_email.strip()
            elif recipient_emp and recipient_emp.email:
                recipient_email = recipient_emp.email.strip()
            elif recipient_user and recipient_user.email:
                recipient_email = recipient_user.email.strip()

            if not recipient_email:
                return

            # Avoid sending email to self
            if sender_user and recipient_user and sender_user.id == recipient_user.id:
                return

            # 3. Pull details for specific related items
            details = []
            # Meeting
            if notif.type in ("meeting_scheduled", "meeting") or (notif.link and "/meetings" in notif.link):
                meeting = Meeting.query.get(notif.related_id) if notif.related_id else None
                if meeting:
                    details.append(f"• Meeting Title: {meeting.title}")
                    date_str = meeting.date.strftime('%A, %B %d, %Y') if hasattr(meeting.date, 'strftime') else str(meeting.date)
                    details.append(f"• Date: {date_str}")
                    if meeting.time:
                        details.append(f"• Time: {meeting.time}")
                    if meeting.venue:
                        details.append(f"• Venue / Location: {meeting.venue}")
                    if meeting.agenda:
                        details.append(f"• Agenda: {meeting.agenda}")
                    if meeting.attendee_names:
                        details.append(f"• Invited Attendees: {', '.join(meeting.attendee_names)}")

            # Action item
            elif notif.type == "action_item":
                ai = ActionItem.query.get(notif.related_id) if notif.related_id else None
                if ai:
                    details.append(f"• Action Item: {ai.description}")
                    if ai.meeting_title:
                        details.append(f"• Meeting Reference: {ai.meeting_title}")
                    if ai.due_date:
                        details.append(f"• Due Date: {ai.due_date}")

            # Task
            elif notif.type.startswith("task") or (notif.link and "/tasks" in notif.link):
                task = Task.query.get(notif.related_id) if notif.related_id else None
                if task:
                    details.append(f"• Task Title: {task.title}")
                    if task.description:
                        details.append(f"• Description: {task.description}")
                    if task.deadline:
                        deadline_str = task.deadline.strftime('%A, %B %d, %Y at %H:%M') if hasattr(task.deadline, 'strftime') else str(task.deadline)
                        details.append(f"• Deadline: {deadline_str}")
                    elif task.expected_completion_date:
                        comp_str = task.expected_completion_date.strftime('%A, %B %d, %Y') if hasattr(task.expected_completion_date, 'strftime') else str(task.expected_completion_date)
                        details.append(f"• Expected Completion: {comp_str}")
                    details.append(f"• Status: {task.status}")

            # Report
            elif notif.type.startswith("report") or (notif.link and "/reports" in notif.link):
                report = Report.query.get(notif.related_id) if notif.related_id else None
                if report:
                    details.append(f"• Report Heading: {report.heading}")
                    if report.category:
                        details.append(f"• Category: {report.category}")
                    if report.department_name:
                        details.append(f"• Department: {report.department_name}")
                    if report.description:
                        details.append(f"• Summary: {report.description}")

            # 4. Compose email content
            subject = f"[EPIC TASK SYSTEM] {notif.title} — from {sender_name}"

            body_lines = [
                f"Hello {recipient_name},",
                "",
                f"You have received a new notification from {sender_name} ({sender_role}) regarding: {notif.title}",
                "",
                "─────────────────────────────────────────────────────────────",
                "NOTIFICATION OVERVIEW",
                "─────────────────────────────────────────────────────────────",
                f"• Sender: {sender_name} ({sender_role})",
                f"• Event: {notif.title}",
                f"• Message: {notif.message}",
                f"• Timestamp: {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}",
            ]

            if details:
                body_lines.extend([
                    "",
                    "─────────────────────────────────────────────────────────────",
                    "DETAILS",
                    "─────────────────────────────────────────────────────────────",
                ] + details)

            body_lines.extend([
                "",
                "─────────────────────────────────────────────────────────────",
                "ACTION / NEXT STEPS",
                "─────────────────────────────────────────────────────────────",
                "To view the full record and take action, please sign in to your EPIC TASK PERFORMANCE TRACKING SYSTEM account:",
                f"http://localhost:5173{notif.link or '/'}",
                "",
                "Notice: This notification was dispatched to your active personal email address while company domain emails are in process.",
                "",
                "—",
                "EPIC TASK PERFORMANCE TRACKING SYSTEM",
                f"Sent on behalf of {sender_name}",
            ])

            body = "\n".join(body_lines)
            send_email(to=recipient_email, subject=subject, body=body)
        except Exception as e:
            import logging
            logging.getLogger("notifications").exception("Failed to dispatch notification email: %s", e)

    register_entity(
        bp,
        Notification,
        "notifications",
        create="any",
        update="owner_or_admin",
        delete="owner_or_admin",
        owner_field="user_id",
        after_create=on_create_notification,
    )
    register_entity(bp, PerformanceReport, "performance-reports", create="admin", update="admin", delete="admin")
    register_entity(
        bp,
        Report,
        "reports",
        create="any",
        update="owner_or_admin",
        delete="owner_or_admin",
        list_filter=filter_reports_confidentiality,
    )

    PRIORITY_WEIGHTS = {"Low": 1, "Medium": 2, "High": 3, "Urgent": 5}

    def validate_task_create(task, user, data=None):
        from datetime import date as dt_date, datetime
        raw_exp = (data.get("expected_completion_date") if data else None) or getattr(task, "expected_completion_date", None)
        if raw_exp:
            try:
                exp_date = datetime.strptime(str(raw_exp).strip().split("T")[0], "%Y-%m-%d").date()
                if exp_date < dt_date.today():
                    return "Task expected completion date cannot be in the past."
            except Exception:
                pass

        # Helper: check for administrator assignees
        def check_admin_assignees(ids):
            if not ids:
                return None
            admin_employees = Employee.query.filter(
                Employee.id.in_(ids),
                (Employee.role.in_(("Super Administrator", "Administrator")) | (Employee.role.ilike("%admin%")))
            ).all()
            admin_users = User.query.filter(
                User.id.in_(ids),
                User.role == "admin"
            ).all()
            target_employees = Employee.query.filter(Employee.id.in_(ids)).all()
            linked_user_ids = [e.user_id for e in target_employees if e.user_id]
            linked_admin_users = User.query.filter(User.id.in_(linked_user_ids), User.role == "admin").all() if linked_user_ids else []
            if admin_employees or admin_users or linked_admin_users:
                return "Tasks cannot be assigned to Administrators. Administrators oversee operations rather than receiving performance task assignments."
            return None

        # 1. Prevent self-assignment
        assignee_ids = (data.get("assigned_to_ids") if data else None) or getattr(task, "assigned_to_ids", []) or []
        emp = Employee.query.filter((Employee.user_id == user.id) | (Employee.email == user.email)).first() if user else None
        if user and (user.id in assignee_ids or (emp and emp.id in assignee_ids)):
            return "Self-assignment is not allowed. Staff members cannot assign official performance tasks to themselves. Please use your personal To-Do list for self-directed tasks."

        # 2. Prevent assignment to Administrators
        admin_err = check_admin_assignees(assignee_ids)
        if admin_err:
            return admin_err

        # 3. Priority & weight synchronization
        prio = (data.get("priority") if data else None) or getattr(task, "priority", None) or "Medium"
        task.priority = prio
        raw_weight = (data.get("weight") if data else None) or getattr(task, "weight", None)
        if raw_weight:
            try:
                task.weight = int(raw_weight)
            except Exception:
                task.weight = PRIORITY_WEIGHTS.get(prio, 2)
        else:
            task.weight = PRIORITY_WEIGHTS.get(prio, 2)

        return None

    def validate_task_update(task, user, data=None):
        from datetime import date as dt_date, datetime
        raw_exp = (data.get("expected_completion_date") if data else None) or getattr(task, "expected_completion_date", None)
        if raw_exp:
            try:
                exp_date = datetime.strptime(str(raw_exp).strip().split("T")[0], "%Y-%m-%d").date()
                if exp_date < dt_date.today():
                    return "Task expected completion date cannot be in the past."
            except Exception:
                pass

        emp = Employee.query.filter((Employee.user_id == user.id) | (Employee.email == user.email)).first() if user else None
        emp_role = emp.role if emp else getattr(user, "role", "")

        # 1. Prevent self-assignment and assignment to Administrators if assigned_to_ids is modified
        if data and "assigned_to_ids" in data:
            assignee_ids = data.get("assigned_to_ids") or []
            if user and (user.id in assignee_ids or (emp and emp.id in assignee_ids)):
                return "Self-assignment is not allowed. Tasks cannot be assigned to oneself."

            # Check administrator assignees
            admin_employees = Employee.query.filter(
                Employee.id.in_(assignee_ids),
                (Employee.role.in_(("Super Administrator", "Administrator")) | (Employee.role.ilike("%admin%")))
            ).all()
            admin_users = User.query.filter(
                User.id.in_(assignee_ids),
                User.role == "admin"
            ).all()
            target_employees = Employee.query.filter(Employee.id.in_(assignee_ids)).all()
            linked_user_ids = [e.user_id for e in target_employees if e.user_id]
            linked_admin_users = User.query.filter(User.id.in_(linked_user_ids), User.role == "admin").all() if linked_user_ids else []
            if admin_employees or admin_users or linked_admin_users:
                return "Tasks cannot be assigned to Administrators. Administrators oversee operations rather than receiving performance task assignments."

        # 2. Prevent self-approval & ensure only assigner or admin can approve
        new_status = data.get("status") if data else None
        is_approving = new_status == "Completed" or (data and (data.get("approved_by_id") or data.get("approved_date")))
        if is_approving and task.status != "Completed":
            task_assignees = task.assigned_to_ids or []
            if user and (user.id in task_assignees or (emp and emp.id in task_assignees)):
                return "Assignees cannot approve their own tasks. Only the person who assigned the task or an Administrator can approve."

            is_assigner = (user and (task.assigned_by_id == user.id or (emp and task.assigned_by_id == emp.id)))
            is_admin = (user and user.role in ("admin", "Super Administrator", "Director of Operations")) or emp_role in ("Super Administrator", "Director of Operations")
            if not (is_assigner or is_admin):
                return "Only the person who assigned this task or an authorized Administrator can approve it."

        # 3. Priority & weight synchronization
        if data and ("priority" in data or "weight" in data):
            prio = data.get("priority") or getattr(task, "priority", "Medium")
            task.priority = prio
            raw_weight = data.get("weight")
            if raw_weight is not None:
                try:
                    task.weight = int(raw_weight)
                except Exception:
                    task.weight = PRIORITY_WEIGHTS.get(prio, 2)
            elif "priority" in data:
                task.weight = PRIORITY_WEIGHTS.get(prio, 2)

        return None

    register_entity(
        bp,
        Task,
        "tasks",
        create="any",
        update="any",
        delete="owner_or_admin",
        before_create=validate_task_create,
        before_update=validate_task_update,
    )

    def filter_todo_items(todos, user):
        if not user:
            return []
        if user.role in ("admin", "Super Administrator", "Director of Operations"):
            return todos

        emp = Employee.query.filter((Employee.user_id == user.id) | (Employee.email == user.email)).first()
        emp_role = emp.role if emp else user.role
        if emp_role in ("Super Administrator", "Director of Operations"):
            return todos

        if emp_role == "Department Manager" and emp and emp.department_id:
            return [
                t for t in todos
                if (t.department_id == emp.department_id)
                or (t.employee_id == emp.id)
                or (t.created_by_id == user.id)
            ]

        emp_id = emp.id if emp else None
        return [
            t for t in todos
            if (emp_id and t.employee_id == emp_id)
            or (t.created_by_id == user.id)
            or (t.employee_id == user.id)
        ]

    def before_create_todo_item(todo, user, data=None):
        if not user:
            return "Authentication required"
        emp = Employee.query.filter((Employee.user_id == user.id) | (Employee.email == user.email)).first()
        if emp:
            todo.employee_id = emp.id
            todo.employee_name = emp.full_name
            todo.department_id = emp.department_id
        else:
            todo.employee_id = user.id
            todo.employee_name = user.full_name or user.email
        todo.created_by_id = user.id
        return None

    register_entity(
        bp,
        TodoItem,
        "todo-items",
        create="any",
        update="owner_or_admin",
        delete="owner_or_admin",
        owner_field="created_by_id",
        list_filter=filter_todo_items,
        before_create=before_create_todo_item,
    )

    return bp

