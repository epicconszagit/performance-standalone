from datetime import date, datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Employee, Meeting, Notification
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
