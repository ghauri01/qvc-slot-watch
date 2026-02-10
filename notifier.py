import logging
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import config

log = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds


def send_alert(slots: list[dict]) -> bool:
    """Send an HTML email listing available appointment slots.

    Each slot dict should have keys: 'date' and optionally 'time', 'location'.
    Returns True if the email was sent successfully.
    """
    rows = ""
    for s in slots:
        date = s.get("date", "Unknown")
        slot_time = s.get("time", "—")
        location = s.get("location", config.QVC_LOCATION)
        rows += f"<tr><td>{date}</td><td>{slot_time}</td><td>{location}</td></tr>\n"

    html = f"""\
    <html>
    <body>
    <h2>Qatar Visa Center — Appointment Slots Available!</h2>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>Date</th><th>Time</th><th>Location</th></tr>
      {rows}
    </table>
    <p><a href="{config.BOOKING_URL}">Book now &rarr;</a></p>
    <p style="color:gray;font-size:12px;">Sent by hussain_bot appointment monitor.</p>
    </body>
    </html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"QVC Appointment Available — {len(slots)} slot(s) found"
    msg["From"] = config.SMTP_USER
    msg["To"] = config.RECIPIENT_EMAIL
    msg.attach(MIMEText(html, "html"))

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30) as server:
                server.starttls()
                server.login(config.SMTP_USER, config.SMTP_PASSWORD)
                server.sendmail(config.SMTP_USER, config.RECIPIENT_EMAIL, msg.as_string())
            log.info("Email alert sent to %s", config.RECIPIENT_EMAIL)
            return True
        except Exception:
            log.warning("SMTP attempt %d/%d failed", attempt, MAX_RETRIES, exc_info=True)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)

    log.error("Failed to send email after %d attempts", MAX_RETRIES)
    return False
