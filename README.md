# Qatar Visa Center Appointment Monitor

Automated appointment availability checker for Qatar Visa Center (QVC). The bot monitors the QVC website for available appointment slots and sends email alerts when dates become available.

## Features

- Automated browser navigation using Playwright
- Captcha auto-solving with OCR (ddddocr)
- Captcha retry logic (up to 5 attempts per check)
- Automatic form filling (passport, visa, mobile, email)
- Calendar scraping for available dates
- Email notifications via SMTP
- Configurable check interval (default: 10 minutes)
- Runs in headed or headless browser mode

## Prerequisites

- Python 3.10+
- Tesseract OCR ([download](https://github.com/UB-Mannheim/tesseract/wiki))

## Setup

1. Clone the repository:

```bash
git clone <repo-url>
cd qvc-slot-watch 
```

2. Install dependencies:

```bash
pip install -r requirements.txt
playwright install chromium
```

3. Configure environment variables:

```bash
cp .env.example .env
```

Edit `.env` and fill in all required fields:

| Variable | Description |
|---|---|
| `PASSPORT_NUMBER` | Applicant passport number |
| `VISA_NUMBER` | Visa reference number (VRN) |
| `MOBILE_NUMBER` | Mobile number with country code (e.g., +923001234567) |
| `EMAIL_ADDRESS` | Applicant email address |
| `SMTP_USER` | Gmail address for sending alerts |
| `SMTP_PASSWORD` | Gmail app password ([generate here](https://myaccount.google.com/apppasswords)) |
| `RECIPIENT_EMAIL` | Email to receive appointment alerts |

4. Run the monitor:

```bash
python monitor.py
```

## How It Works

1. Navigates to qatarvisacenter.com
2. Selects language (English) and country (Pakistan)
3. Fills passport and visa number
4. Solves captcha using OCR (retries on failure)
5. Submits form and handles session popups
6. Fills applicant details (mobile, email)
7. Scrapes the appointment calendar for available dates
8. Sends email alert if slots are found
9. Repeats every 10 minutes

## Project Structure

```
qvc-slot-watch/
  browser.py       # Playwright browser automation + captcha solver
  config.py         # Environment variable loader
  monitor.py        # Main monitoring loop
  notifier.py       # Email notification sender
  .env.example      # Environment variable template
  requirements.txt  # Python dependencies
  logs/             # Screenshots, captcha images, logs (gitignored)
```

## Configuration

All settings are in `.env`:

- `CHECK_INTERVAL_MINUTES` - How often to check (default: 10)
- `HEADLESS` - Run browser without UI (default: false)
- `QVC_LOCATION` - QVC center to monitor (default: Islamabad)
- `LOG_LEVEL` - Logging verbosity (default: INFO)
