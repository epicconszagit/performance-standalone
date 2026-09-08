import logging
import os

logger = logging.getLogger("sms")
logging.basicConfig(level=logging.INFO)

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_API_KEY_SID = os.environ.get("TWILIO_API_KEY_SID")
TWILIO_API_KEY_SECRET = os.environ.get("TWILIO_API_KEY_SECRET")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")

_client = None
if TWILIO_ACCOUNT_SID and TWILIO_FROM_NUMBER:
    from twilio.rest import Client

    if TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET:
        # API Key auth: Client(api_key_sid, api_key_secret, account_sid)
        _client = Client(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_ACCOUNT_SID)
    elif TWILIO_AUTH_TOKEN:
        _client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def send_sms(to, message):
    """Sends a real SMS via Twilio if credentials are configured; otherwise
    falls back to logging it (same stub pattern as send_email).
    """
    if not to:
        return False

    to = to.strip()
    if not to.startswith("+"):
        logger.warning("Skipping SMS to %r - missing country code (needs E.164 format, e.g. +263...)", to)
        return False

    if _client is None:
        logger.info("STUB SMS -> to=%s\n%s", to, message)
        return True

    try:
        _client.messages.create(to=to, from_=TWILIO_FROM_NUMBER, body=message)
        return True
    except Exception:
        logger.exception("Failed to send SMS to %s", to)
        return False
