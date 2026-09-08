import re

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

MIN_PASSWORD_LENGTH = 8


def validate_registration_email(email):
    email = (email or "").strip().lower()
    if not EMAIL_REGEX.match(email):
        return False, "Please enter a valid email address."
    return True, None


def validate_password(password):
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        return False, f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
    return True, None
