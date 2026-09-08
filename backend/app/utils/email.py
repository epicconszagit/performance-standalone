import logging
import os
import smtplib
from email.mime.text import MIMEText

logger = logging.getLogger("email")
logging.basicConfig(level=logging.INFO)

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM = os.environ.get("SMTP_FROM") or SMTP_USERNAME


def send_email(to, subject, body):
    """Sends real email via SMTP (Gmail by default) if credentials are
    configured; otherwise falls back to logging it (same stub pattern as
    send_sms).
    """
    if not to:
        return False

    if not (SMTP_USERNAME and SMTP_PASSWORD):
        logger.info("STUB EMAIL -> to=%s subject=%r\n%s", to, subject, body)
        return True

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to], msg.as_string())
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False
