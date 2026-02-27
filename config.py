import os
import sys
from dotenv import load_dotenv

load_dotenv()


def _get(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


# Booking details
BOOKING_URL = _get("BOOKING_URL", "https://www.qatarvisacenter.com/")
COUNTRY_OF_RESIDENCE = _get("COUNTRY_OF_RESIDENCE", "Pakistan")
QVC_LOCATION = _get("QVC_LOCATION", "Islamabad")

# Applicant credentials
PASSPORT_NUMBER = _get("PASSPORT_NUMBER")
VISA_NUMBER = _get("VISA_NUMBER")
MOBILE_NUMBER = _get("MOBILE_NUMBER")
EMAIL_ADDRESS = _get("EMAIL_ADDRESS")

# SMTP
SMTP_HOST = _get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(_get("SMTP_PORT", "587"))
SMTP_USER = _get("SMTP_USER")
SMTP_PASSWORD = _get("SMTP_PASSWORD")
RECIPIENT_EMAIL = _get("RECIPIENT_EMAIL")

# Bot settings
CHECK_INTERVAL_MINUTES = int(_get("CHECK_INTERVAL_MINUTES", "10"))
HEADLESS = _get("HEADLESS", "false").lower() in ("true", "1", "yes")
LOG_LEVEL = _get("LOG_LEVEL", "INFO").upper()

# Browser extension (path to unpacked extension folder)
EXTENSION_PATH = _get("EXTENSION_PATH", "")

# How long to keep the browser open on the calendar page (minutes)
CALENDAR_WAIT_MINUTES = int(_get("CALENDAR_WAIT_MINUTES", "10"))

# Required fields validation
_REQUIRED = {
    "PASSPORT_NUMBER": PASSPORT_NUMBER,
    "VISA_NUMBER": VISA_NUMBER,
    "MOBILE_NUMBER": MOBILE_NUMBER,
    "EMAIL_ADDRESS": EMAIL_ADDRESS,
    "SMTP_USER": SMTP_USER,
    "SMTP_PASSWORD": SMTP_PASSWORD,
    "RECIPIENT_EMAIL": RECIPIENT_EMAIL,
}


def validate() -> None:
    missing = [k for k, v in _REQUIRED.items() if not v]
    if missing:
        print(f"ERROR: Missing required .env values: {', '.join(missing)}")
        print("Copy .env.example to .env and fill in all required fields.")
        sys.exit(1)
