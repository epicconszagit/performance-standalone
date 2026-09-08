from datetime import date

from ..extensions import db
from ..models import Employee, Notification

# Roles that get notified so they can organize a celebration - mirrors the
# admin-ish groupings used elsewhere (Layout.jsx's CAN_APPROVE_* lists).
CELEBRATION_ROLES = {"Super Administrator", "Administrator", "Director of Operations", "Department Manager"}


def run_birthday_check():
    """Notifies admins/managers about staff whose birthday is today, so they
    can celebrate them. Dedupes per employee per calendar year via the
    "birthday" notification's related_id + created_date, so each birthday
    only notifies once a year even though the same month/day recurs annually.
    """
    today = date.today()
    employees = Employee.query.all()
    birthday_employees = [
        e for e in employees
        if e.date_of_birth and e.status != "inactive"
        and e.date_of_birth.month == today.month
        and e.date_of_birth.day == today.day
    ]
    if not birthday_employees:
        return {"checked": 0, "notified": 0}

    year_start = date(today.year, 1, 1)
    existing = Notification.query.filter(
        Notification.type == "birthday",
        Notification.created_date >= year_start,
    ).all()
    notified_this_year = {n.related_id for n in existing}

    celebrants = [e for e in employees if e.role in CELEBRATION_ROLES]

    notified_count = 0
    for emp in birthday_employees:
        if emp.id in notified_this_year:
            continue
        for recipient in celebrants:
            if recipient.id == emp.id:
                continue
            db.session.add(Notification(
                user_id=recipient.user_id or recipient.id,
                employee_id=recipient.id,
                title="Birthday Today",
                message=f"It's {emp.full_name}'s birthday today! Take a moment to wish them well.",
                type="birthday",
                related_id=emp.id,
                link="/",
            ))
        notified_count += 1

    db.session.commit()
    return {"checked": len(birthday_employees), "notified": notified_count}
