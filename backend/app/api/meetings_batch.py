from datetime import date, datetime, timedelta
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Employee, Meeting, Notification, AuditLog, Announcement
from ..utils.email import send_email
from .generic import current_user

meetings_batch_bp = Blueprint("meetings_batch", __name__)


@meetings_batch_bp.route("/meetings/batch", methods=["POST"])
@jwt_required()
def create_meetings_batch():
    user = current_user()
    if not user:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    meetings_data = data.get("meetings") or []
    summary_title = data.get("summary_title") or "Meeting Series Scheduled"
    summary_message = data.get("summary_message") or ""

    if not isinstance(meetings_data, list) or len(meetings_data) == 0:
        return jsonify({"error": "No meetings provided to schedule."}), 400

    created_meetings = []
    unique_attendee_ids = set()
    today = date.today()

    for item in meetings_data:
        raw_date = item.get("date")
        if not raw_date:
            continue
        try:
            m_date = date.fromisoformat(raw_date.strip().split("T")[0]) if isinstance(raw_date, str) else raw_date
        except Exception:
            continue

        # Skip any dates that have already passed
        if isinstance(m_date, date) and m_date < today:
            continue

        attendee_ids = item.get("attendee_ids") or []
        for a_id in attendee_ids:
            unique_attendee_ids.add(a_id)

        meeting = Meeting(
            title=item.get("title") or "Scheduled Meeting",
            date=m_date,
            time=item.get("time") or "",
            venue=item.get("venue") or "",
            agenda=item.get("agenda") or "",
            resolutions=item.get("resolutions") or "",
            attendee_ids=attendee_ids,
            attendee_names=item.get("attendee_names") or [],
            status=item.get("status") or "Scheduled",
            created_by_id=user.id,
            created_by_name=user.full_name or user.email,
            department_id=item.get("department_id") or "",
            meeting_type=item.get("meeting_type") or "custom",
        )
        db.session.add(meeting)
        created_meetings.append(meeting)

    if not created_meetings:
        return jsonify({
            "error": "Cannot schedule meetings for dates that have passed. Meeting dates must start from the current date going forward."
        }), 400

    db.session.commit()

    # Find the current user's employee record if any
    current_emp = Employee.query.filter((Employee.user_id == user.id) | (Employee.email == user.email)).first()
    current_emp_id = current_emp.id if current_emp else None

    # Send summary notification to all invited attendees
    first_meeting = created_meetings[0]
    total_count = len(created_meetings)
    if not summary_message:
        summary_message = f"{user.full_name or user.email} scheduled {total_count} sessions of '{first_meeting.title}'."

    for emp_id in unique_attendee_ids:
        if emp_id == current_emp_id:
            continue
        emp = Employee.query.get(emp_id)
        if not emp:
            continue
        target_user_id = emp.user_id or emp.id
        notif = Notification(
            user_id=target_user_id,
            employee_id=emp.id,
            title=summary_title,
            message=summary_message,
            type="meeting_scheduled",
            related_id=first_meeting.id,
            link="/meetings",
        )
        db.session.add(notif)
        db.session.flush()

        # Send email notification
        target_email = (emp.personal_email or emp.email or "").strip()
        if target_email:
            email_body = (
                f"Hi {emp.full_name},\n\n"
                f"{summary_message}\n\n"
                f"Series Overview:\n"
                f"• Title: {first_meeting.title}\n"
                f"• Total Scheduled Sessions: {total_count}\n"
                f"• Time: {first_meeting.time or 'Scheduled'}\n"
                f"• Venue / Location: {first_meeting.venue or 'TBA'}\n\n"
                f"Log in to the system to view all dates and details: /meetings"
            )
            try:
                send_email(to=target_email, subject=summary_title, body=email_body)
            except Exception:
                pass

    db.session.commit()

    return jsonify({
        "count": len(created_meetings),
        "created": [m.to_dict() for m in created_meetings]
    }), 201


@meetings_batch_bp.route("/meetings/adjust-schedule", methods=["POST"])
@jwt_required()
def adjust_meetings_schedule():
    """Adjusts existing meetings in the system so they follow the Monday, Wednesday, Friday schedule.
    Non-MWF meeting dates are mapped:
    - Tuesday (1) -> Wednesday (+1 day)
    - Thursday (3) -> Friday (+1 day)
    - Saturday (5) -> Monday (+2 days)
    - Sunday (6) -> Monday (+1 day)
    """
    user = current_user()
    if not user:
        return jsonify({"error": "forbidden"}), 403

    meetings = Meeting.query.all()
    adjusted = []

    for m in meetings:
        if not m.date:
            continue
        m_date = m.date if isinstance(m.date, date) else date.fromisoformat(str(m.date).split("T")[0])
        dow = m_date.weekday()  # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
        if dow in (0, 2, 4):
            continue  # Already Monday, Wednesday, or Friday

        delta_days = 1
        if dow == 5:
            delta_days = 2
        elif dow in (1, 3, 6):
            delta_days = 1

        new_date = m_date + timedelta(days=delta_days)
        old_date_str = m_date.isoformat()
        new_date_str = new_date.isoformat()

        m.date = new_date
        # If title contained the old date, update it
        if old_date_str in m.title:
            m.title = m.title.replace(old_date_str, new_date_str)

        # Log audit
        audit = AuditLog(
            action="Adjusted Meeting Schedule",
            entity_type="Meeting",
            entity_id=m.id,
            entity_name=m.title,
            performed_by_id=user.id,
            performed_by_name=user.full_name or user.email,
            details=f"Moved from {old_date_str} ({m_date.strftime('%A')}) to {new_date_str} ({new_date.strftime('%A')}) to follow Monday, Wednesday, Friday schedule.",
        )
        db.session.add(audit)
        adjusted.append({
            "id": m.id,
            "title": m.title,
            "old_date": old_date_str,
            "new_date": new_date_str,
            "new_day": new_date.strftime("%A"),
        })

    if adjusted:
        db.session.commit()

    return jsonify({
        "message": f"Successfully adjusted {len(adjusted)} meeting(s) to Monday, Wednesday, or Friday schedule.",
        "adjusted_count": len(adjusted),
        "adjusted": adjusted,
    }), 200


@meetings_batch_bp.route("/meetings/notify-schedule-update", methods=["POST"])
@jwt_required()
def notify_schedule_update():
    """Broadcasts a notification to staff informing them of the Monday, Wednesday, Friday meeting schedule."""
    user = current_user()
    if not user:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    custom_title = data.get("title") or "Meeting Schedule Update: Monday, Wednesday & Friday"
    custom_message = data.get("message") or (
        "Please note that all regular standups and team alignment meetings are scheduled for "
        "Monday, Wednesday, and Friday at 08:30 AM. Any previously scheduled meeting records "
        "have been adjusted to follow this new schedule. Please check the Meetings page for your updated schedule."
    )

    # 1. Notify all active employees
    employees = Employee.query.filter_by(status="active").all()
    created_notifs = []
    for emp in employees:
        target_user_id = emp.user_id or emp.id
        notif = Notification(
            user_id=target_user_id,
            employee_id=emp.id,
            title=custom_title,
            message=custom_message,
            type="meeting_scheduled",
            link="/meetings",
        )
        db.session.add(notif)
        created_notifs.append(notif)

        target_email = (emp.personal_email or emp.email or "").strip()
        if target_email:
            try:
                send_email(
                    to=target_email,
                    subject=custom_title,
                    body=f"Hi {emp.full_name},\n\n{custom_message}\n\nView schedule: /meetings"
                )
            except Exception:
                pass

    # 2. Add / Update pinned Announcement so it appears on Dashboard and Announcements
    announcement = Announcement.query.filter_by(title=custom_title).first()
    if not announcement:
        announcement = Announcement(
            title=custom_title,
            content=custom_message,
            category="Meetings & Schedule",
            pinned=True,
            active=True,
            created_by_id=user.id,
            created_by_name=user.full_name or user.email,
        )
        db.session.add(announcement)
    else:
        announcement.content = custom_message
        announcement.pinned = True
        announcement.active = True

    # 3. Log audit
    audit = AuditLog(
        action="Broadcast Meeting Schedule Update",
        entity_type="Meeting",
        entity_id="all",
        entity_name=custom_title,
        performed_by_id=user.id,
        performed_by_name=user.full_name or user.email,
        details="Notified all active staff that regular meetings are set for Monday, Wednesday, and Friday.",
    )
    db.session.add(audit)
    db.session.commit()

    return jsonify({
        "message": f"Successfully notified {len(created_notifs)} staff member(s) of the updated meeting days.",
        "notified_count": len(created_notifs),
    }), 200

