import json
import logging
import os
import smtplib
import urllib.error
import urllib.request
from email.mime.text import MIMEText

try:
    from dotenv import load_dotenv
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    load_dotenv(os.path.join(base_dir, ".env"))
except Exception:
    pass

logger = logging.getLogger("email")
logging.basicConfig(level=logging.INFO)


def send_email(to, subject, body, category="general"):
    """Sends real email via Resend HTTPS API (Port 443) or SMTP fallback.
    Resend operates over HTTPS port 443 which is never blocked by cloud providers.
    Supports dedicated Onboarding API key / sender or General Performance key.
    """
    if not to:
        return False

    # Ensure environment variables are fresh from .env
    try:
        from dotenv import load_dotenv
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        load_dotenv(os.path.join(base_dir, ".env"), override=True)
    except Exception:
        pass

    sub_lower = (subject or "").lower()
    is_onboarding = (
        category == "onboarding"
        or "onboard" in sub_lower
        or "account has been created" in sub_lower
        or "account has been approved" in sub_lower
        or "welcome" in sub_lower
    )

    if is_onboarding and os.environ.get("RESEND_ONBOARDING_API_KEY"):
        resend_key = os.environ.get("RESEND_ONBOARDING_API_KEY")
        sender = os.environ.get("RESEND_ONBOARDING_FROM") or "EPIC Onboarding <onboarding@epicnetworkgroup.co>"
    else:
        resend_key = os.environ.get("RESEND_API_KEY") or os.environ.get("RESEND_ONBOARDING_API_KEY")
        sender = os.environ.get("RESEND_FROM") or "EPIC Performance <notifications@epicnetworkgroup.co>"

    if resend_key:
        payload = json.dumps({
            "from": sender,
            "to": [to],
            "subject": subject,
            "text": body,
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {resend_key.strip()}",
                "Content-Type": "application/json",
                "User-Agent": "EpicPerformance/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
                logger.info("Successfully sent email via Resend to %s: %s", to, result)
                return True
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            logger.error("Resend HTTP error %s sending to %s: %s", e.code, to, err_body)
            return False
        except Exception as e:
            logger.exception("Failed to send email via Resend to %s: %s", to, e)
            return False

    # Fallback to SMTP if RESEND_API_KEY is not configured
    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    port = int(os.environ.get("SMTP_PORT", "465"))
    username = os.environ.get("SMTP_USERNAME")
    password = os.environ.get("SMTP_PASSWORD")
    sender = os.environ.get("SMTP_FROM") or username

    if not (username and password):
        logger.info("STUB EMAIL -> to=%s subject=%r\n%s", to, subject, body)
        return False

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
        logger.info("Successfully sent email via SMTP to %s", to)
        return True
    except Exception as e:
        logger.exception("Failed to send email via SMTP to %s: %s", to, e)
        return False


