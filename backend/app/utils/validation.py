import re
import socket

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

MIN_PASSWORD_LENGTH = 8

COMMON_DOMAIN_TYPOS = {
    "gmaill.com": "gmail.com",
    "gmai.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "hotmial.com": "hotmail.com",
    "hotmaill.com": "hotmail.com",
    "outlok.com": "outlook.com",
}


def validate_registration_email(email):
    email = (email or "").strip().lower()
    if not email:
        return False, "Email address is required."

    if not EMAIL_REGEX.match(email):
        return False, "Please enter a valid email address (e.g. name@example.com)."

    parts = email.split("@")
    if len(parts) != 2:
        return False, "Please enter a valid email address."

    domain = parts[1]

    if domain in COMMON_DOMAIN_TYPOS:
        return False, f"Invalid domain. Did you mean @{COMMON_DOMAIN_TYPOS[domain]}?"

    tld = domain.split(".")[-1]
    if len(tld) < 2:
        return False, "Email domain extension is invalid."

    # Real-world DNS domain existence check
    try:
        socket.gethostbyname(domain)
    except socket.gaierror:
        return False, f"The email domain '{domain}' does not exist or cannot receive mail."
    except Exception:
        # Fallback if local machine is completely offline
        pass

    return True, None


def validate_password(password):
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        return False, f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
    return True, None
