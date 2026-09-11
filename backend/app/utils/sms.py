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


def normalize_phone_number(phone, default_country_code="+263"):
    """Normalizes any phone number into E.164 international format.
    Accepts:
      - Local Zimbabwean numbers starting with '07...' (e.g. 0771234567 -> +263771234567)
      - Numbers without leading zero (e.g. 771234567 -> +263771234567)
      - International prefix with 00 (e.g. 00263771234567 -> +263771234567)
      - Standard international format (e.g. +263771234567, +27..., +1...)
      - Strips spaces, hyphens, and brackets.
    """
    if not phone:
        return ""

    import re
    cleaned = re.sub(r"[\s\-\(\)\.]", "", str(phone).strip())
    if not cleaned:
        return ""

    if cleaned.startswith("+"):
        return cleaned

    if cleaned.startswith("00"):
        return "+" + cleaned[2:]

    # Local format starting with 0 (e.g. 077..., 071..., 078...)
    if cleaned.startswith("0"):
        return default_country_code + cleaned[1:]

    # Starts with 263 without +
    if cleaned.startswith("263"):
        return "+" + cleaned

    # Starts with 7... (9 digits standard mobile)
    if len(cleaned) == 9 and cleaned.startswith("7"):
        return default_country_code + cleaned

    # Fallback: if digits only, prefix with + if long enough, else default country code
    if cleaned.isdigit():
        if len(cleaned) > 10:
            return "+" + cleaned
        return default_country_code + cleaned

    return cleaned


def send_sms(to, message):
    """Sends a real SMS via Twilio if credentials are configured; otherwise
    falls back to logging it (same stub pattern as send_email).
    Automatically normalizes phone numbers (e.g. 07... -> +263...).
    """
    if not to:
        return False

    to = normalize_phone_number(to)
    if not to.startswith("+"):
        logger.warning("Skipping SMS to %r - could not normalize to E.164 country code format", to)
        return False

    if _client is None:
        logger.info("STUB SMS -> to=%s\n%s", to, message)
        return False

    try:
        _client.messages.create(to=to, from_=TWILIO_FROM_NUMBER, body=message)
        return True
    except Exception:
        logger.exception("Failed to send SMS to %s", to)
        return False

