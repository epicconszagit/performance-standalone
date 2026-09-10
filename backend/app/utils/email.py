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

    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    port = int(os.environ.get("SMTP_PORT", "587"))
    username = os.environ.get("SMTP_USERNAME")
    password = os.environ.get("SMTP_PASSWORD")
    sender = os.environ.get("SMTP_FROM") or username

    if not (username and password):
        logger.info("STUB EMAIL -> to=%s subject=%r\n%s", to, subject, body)
        return True

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = f"EPIC TASK PERFORMANCE TRACKING SYSTEM <{sender}>"
    msg["To"] = to

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=10) as server:
                server.login(username, password)
                server.sendmail(sender, [to], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.starttls()
                server.login(username, password)
                server.sendmail(sender, [to], msg.as_string())
        logger.info("Successfully sent email to %s", to)
        return True
    except Exception as e:
        logger.exception("Failed to send email to %s: %s", to, e)
        return False

