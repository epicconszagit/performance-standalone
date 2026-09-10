import json
import logging
import os
import smtplib
import urllib.error
import urllib.request
from email.mime.text import MIMEText

logger = logging.getLogger("email")
logging.basicConfig(level=logging.INFO)


def send_email(to, subject, body):
    """Sends real email via Resend HTTPS API (Port 443) or SMTP fallback.
    Resend operates over HTTPS port 443 which is never blocked by cloud providers.
    """
    if not to:
        return False

    resend_key = os.environ.get("RESEND_API_KEY")
    if resend_key:
        sender = os.environ.get("RESEND_FROM") or "EPIC Performance <onboarding@resend.dev>"
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


