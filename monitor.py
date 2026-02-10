import logging
import os
import signal
import sys
import time
from logging.handlers import RotatingFileHandler

import config
from browser import check_appointments
from notifier import send_alert

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

# Logging setup
log = logging.getLogger()
log.setLevel(getattr(logging, config.LOG_LEVEL, logging.INFO))

fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")

console = logging.StreamHandler()
console.setFormatter(fmt)
log.addHandler(console)

file_handler = RotatingFileHandler(
    "logs/monitor.log", maxBytes=5_000_000, backupCount=3, encoding="utf-8"
)
file_handler.setFormatter(fmt)
log.addHandler(file_handler)

logger = logging.getLogger(__name__)

# Track already-notified dates to avoid duplicate emails
notified_dates: set[str] = set()

# Graceful shutdown flag
running = True


def _shutdown(sig, frame):
    global running
    logger.info("Shutdown signal received — exiting after current cycle.")
    running = False


signal.signal(signal.SIGINT, _shutdown)
signal.signal(signal.SIGTERM, _shutdown)


def main() -> None:
    config.validate()

    logger.info("Qatar Visa Center Appointment Monitor started")
    logger.info(
        "Country: %s | QVC: %s | Interval: %d min | Headless: %s",
        config.COUNTRY_OF_RESIDENCE,
        config.QVC_LOCATION,
        config.CHECK_INTERVAL_MINUTES,
        config.HEADLESS,
    )

    while running:
        logger.info("--- Running appointment check ---")
        try:
            slots = check_appointments()
        except Exception:
            logger.error("Unhandled error in check_appointments", exc_info=True)
            slots = []

        if slots:
            # Filter out already-notified dates
            new_slots = [s for s in slots if s["date"] not in notified_dates]

            if new_slots:
                logger.info("New slots found: %s", [s["date"] for s in new_slots])
                if send_alert(new_slots):
                    for s in new_slots:
                        notified_dates.add(s["date"])
                else:
                    logger.warning("Email failed — will retry next cycle")
            else:
                logger.info("Slots found but already notified — skipping email")
        else:
            logger.info("No available slots found")

        if not running:
            break

        logger.info("Next check in %d minutes...", config.CHECK_INTERVAL_MINUTES)
        # Sleep in small increments so Ctrl+C is responsive
        for _ in range(config.CHECK_INTERVAL_MINUTES * 60):
            if not running:
                break
            time.sleep(1)

    logger.info("Monitor stopped.")


if __name__ == "__main__":
    main()
