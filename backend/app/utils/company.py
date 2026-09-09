import re
import uuid

EMAIL_DOMAIN = "epicnetworkgroup.com"


def _slugify_local_part(text):
    return re.sub(r"[^a-z0-9]", "", (text or "").lower())


def generate_employee_email_base(full_name):
    """first-initial + last-name, e.g. "Jane Doe" -> "jdoe"."""
    parts = [p for p in (full_name or "").strip().split() if p]
    if not parts:
        return "user"
    first = parts[0]
    last = parts[-1] if len(parts) > 1 else ""
    base = _slugify_local_part(first[:1] + last)
    return base or "user"


def generate_department_email_base(name):
    return _slugify_local_part(name) or "dept"


def generate_employee_id_code():
    return f"EIC-{uuid.uuid4().hex[:6].upper()}"


def generate_unique_company_email(full_name):
    from ..models import Employee, User
    base = generate_employee_email_base(full_name)
    candidate = f"{base}@{EMAIL_DOMAIN}"
    suffix = 1
    while User.query.filter_by(email=candidate).first() or Employee.query.filter_by(email=candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}@{EMAIL_DOMAIN}"
    return candidate
