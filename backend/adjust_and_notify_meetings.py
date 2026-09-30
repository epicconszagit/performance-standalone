import os
from datetime import date, datetime, timedelta
from app import create_app
from app.extensions import db
from app.models import Employee, Meeting, Notification, AuditLog, Announcement, User

def adjust_and_notify():
    app = create_app()
    with app.app_context():
        print("=" * 60)
        print("UPDATING MEETING SCHEDULE TO MONDAY, WEDNESDAY, FRIDAY")
        print("=" * 60)

        today = date.today()
        print(f"Current System Date: {today} ({today.strftime('%A')})")

        # 1. Adjust any existing meetings that do not fall on Mon (0), Wed (2), Fri (4)
        existing_meetings = Meeting.query.all()
        print(f"Total existing meetings in database: {len(existing_meetings)}")

        adjusted_count = 0
        admin_user = User.query.filter_by(role="admin").first() or User.query.first()
        admin_id = admin_user.id if admin_user else "system"
        admin_name = admin_user.full_name if admin_user else "System Administrator"

        for m in existing_meetings:
            if not m.date:
                continue
            m_date = m.date if isinstance(m.date, date) else date.fromisoformat(str(m.date).split("T")[0])
            dow = m_date.weekday() # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
            if dow not in (0, 2, 4):
                delta_days = 2 if dow == 5 else 1
                new_date = m_date + timedelta(days=delta_days)
                old_date_str = m_date.isoformat()
                new_date_str = new_date.isoformat()
                print(f" -> Adjusting meeting '{m.title}': {old_date_str} ({m_date.strftime('%A')}) -> {new_date_str} ({new_date.strftime('%A')})")
                m.date = new_date
                if old_date_str in m.title:
                    m.title = m.title.replace(old_date_str, new_date_str)
                audit = AuditLog(
                    action="Adjusted Meeting Schedule",
                    entity_type="Meeting",
                    entity_id=m.id,
                    entity_name=m.title,
                    performed_by_id=admin_id,
                    performed_by_name=admin_name,
                    details=f"Moved from {old_date_str} to {new_date_str} ({new_date.strftime('%A')}) to align with Monday, Wednesday, Friday schedule.",
                )
                db.session.add(audit)
                adjusted_count += 1

        db.session.commit()
        print(f"Adjusted {adjusted_count} meeting record(s).")

        # 2. Check if we need to schedule the recurring Monday, Wednesday, Friday sessions for October 2026
        active_employees = Employee.query.filter_by(status="active").all()
        active_emp_ids = [e.id for e in active_employees]
        active_emp_names = [e.full_name for e in active_employees]

        october_meetings = Meeting.query.filter(
            Meeting.date >= date(2026, 10, 1),
            Meeting.date <= date(2026, 10, 31)
        ).all()

        if len(october_meetings) == 0:
            print("Scheduling Monday, Wednesday, Friday standup meetings for October 2026...")
            mwf_dates = []
            # October 2026: 31 days
            for d in range(1, 32):
                curr = date(2026, 10, d)
                if curr >= today and curr.weekday() in (0, 2, 4):
                    mwf_dates.append(curr)

            for meet_date in mwf_dates:
                day_name = meet_date.strftime('%A')
                formatted_d = meet_date.strftime('%b %d, %Y')
                meeting = Meeting(
                    title=f"Regular Standup - {day_name} ({formatted_d})",
                    date=meet_date,
                    time="08:30",
                    venue="Main Boardroom / Virtual Standup",
                    agenda="Task progress review, deliverables alignment, blockers and priorities check.",
                    resolutions="",
                    attendee_ids=active_emp_ids,
                    attendee_names=active_emp_names,
                    status="Scheduled",
                    created_by_id=admin_id,
                    created_by_name=admin_name,
                    department_id="",
                    meeting_type="daily_morning",
                )
                db.session.add(meeting)

            db.session.commit()
            print(f"Scheduled {len(mwf_dates)} Monday, Wednesday, Friday meeting sessions for October 2026.")
        else:
            print(f"Found {len(october_meetings)} existing October meeting(s).")

        # 3. Notify all staff of the updated schedule through system notifications
        title = "📅 Meeting Schedule Update: Monday, Wednesday & Friday"
        message = (
            "Please note that all regular standups and alignment meetings in the Task Performance Tracking System "
            "are set for Monday, Wednesday, and Friday at 08:30 AM. Any previously scheduled meetings have been "
            "adjusted to follow this new schedule. Please check the Meetings page to view your upcoming sessions."
        )

        notif_count = 0
        for emp in active_employees:
            target_user_id = emp.user_id or emp.id
            notif = Notification(
                user_id=target_user_id,
                employee_id=emp.id,
                title=title,
                message=message,
                type="meeting_scheduled",
                link="/meetings",
            )
            db.session.add(notif)
            notif_count += 1

        # Also ensure admin user gets it if not in employees
        if admin_user and admin_user.id not in [e.user_id for e in active_employees]:
            notif = Notification(
                user_id=admin_user.id,
                employee_id=None,
                title=title,
                message=message,
                type="meeting_scheduled",
                link="/meetings",
            )
            db.session.add(notif)
            notif_count += 1

        print(f"Created {notif_count} in-app notification(s) for staff members.")

        # 4. Post / update pinned announcement on dashboard
        announcement = Announcement.query.filter_by(title="Official Notice: Meeting Schedule Set for Mon, Wed & Fri").first()
        if not announcement:
            announcement = Announcement(
                title="Official Notice: Meeting Schedule Set for Mon, Wed & Fri",
                content=(
                    "All staff members: Please be advised that the Task Performance Tracking System has been updated "
                    "so that all regular company standup and alignment meetings are set for Monday, Wednesday, and Friday "
                    "at 08:30 AM. Any existing meeting records have been adjusted to follow this schedule. "
                    "Please review the Meetings module to see all scheduled sessions."
                ),
                category="Meetings & Schedule",
                pinned=True,
                active=True,
                created_by_id=admin_id,
                created_by_name=admin_name,
            )
            db.session.add(announcement)
            print("Created pinned Announcement for the new schedule.")
        else:
            announcement.active = True
            announcement.pinned = True
            print("Announcement already exists.")

        # 5. Log audit
        audit = AuditLog(
            action="System Meeting Schedule Update",
            entity_type="Meeting",
            entity_id="all",
            entity_name="Monday, Wednesday, Friday Schedule",
            performed_by_id=admin_id,
            performed_by_name=admin_name,
            details="Configured regular meetings for Monday, Wednesday, and Friday, adjusted existing meetings, and notified staff.",
        )
        db.session.add(audit)
        db.session.commit()
        print("Audit log recorded. Process complete!")

if __name__ == "__main__":
    adjust_and_notify()
